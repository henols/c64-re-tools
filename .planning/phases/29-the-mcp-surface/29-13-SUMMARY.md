---
phase: 29-the-mcp-surface
plan: 13
subsystem: api
tags: [mcp, anno-tools, annotation-store, disassembly, batch-validation, typescript]

requires:
  - phase: 29-the-mcp-surface
    provides: the curated anno_* MCP verb surface, its two-phase batch validator, and the sliceSpan/outsideImage refusal pair that plans 29-06 and 29-10 shipped
provides:
  - "A TOTAL sliceSpan(): the guard covers the low bound, the high bound AND an inverted span, so no (start, end) pair yields a silently empty subarray"
  - "anno_disassemble decides refusal from the span the CALLER named, making it agree with anno_read_region for every out-of-image address"
  - "assertAnnoBatch() recurses on batchArgumentsFor(), so phase-one validation and phase-two execution compute an inner call's effective arguments through the SAME function"
  - "ANNO_MAX_BATCH_DEPTH gains a reachable POSITIVE control: a depth-1 nested batch on the documented store inheritance now validates and executes"
  - "dispatchSaveProject() reads the store revision exactly once, so its revision field and its prose cannot name different revisions"
  - "Ten new tests pinning the two read verbs' AGREEMENT, the batch cap's positive and negative controls, and the save verb's single revision read"
affects: [phase-30, anno-tools, mcp-surface, gap-closure]

actuals:
  tokens: 47054
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Verdict agreement asserted as ONE property in ONE test, rather than two independent shapes that can drift apart"
    - "A shared derivation function (batchArgumentsFor) called by every phase that needs the value, never recomputed per phase"
    - "Structural source pins (guard shape, call-site count) beside behavioural pins, for defects whose behavioural symptom is latent"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts

key-decisions:
  - "Test C was rewritten during execution rather than forced: a caller-NAMED inverted span is already refused upstream by anno-types.ts's shared range-shape validator, identically on both verbs. The test now pins that agreement AND the derived-end inverted span that only sliceSpan() can catch."
  - "sliceSpan()'s inverted-span guard was kept even though one of its two routes is caught upstream, because the other route -- an omitted end_address derived from the image's last address, below an out-of-image start -- is exactly the reported CR-01 defect and NO argument validator can see it."
  - "WR-10's behavioural pin passes both before and after the fix; the RED was carried by a structural pin on the call-site count, because two reads agreeing in a single-threaded run is the accident the finding is about."
  - "The tracer feedback gate was run in its autonomous form (re-run the tracer <verify> end-to-end, HALT on failure) rather than as a human-verify checkpoint, on the plan's autonomous: true frontmatter and the orchestrator's autonomous dispatch."

requirements-completed: [MCP-04]

coverage:
  - id: D1
    description: "anno_disassemble and anno_read_region return the SAME {available:false, reason} verdict for an out-of-image address (ROADMAP criterion 5 / CR-01)"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions"
        status: pass
    human_judgment: false
  - id: D2
    description: "sliceSpan() is TOTAL over every (start, end) pair -- an empty span is refused, never served as a zero-length success (probe/empty)"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fix DISCRIMINATES: a span wholly inside the image still succeeds on both verbs, and an omitted end_address still defaults to the image's own bound"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics"
        status: pass
    human_judgment: false
  - id: D4
    description: "A depth-1 nested anno_batch_execute relying on the documented top-level store inheritance both VALIDATES and EXECUTES (D-33 / CR-06)"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes"
        status: pass
    human_judgment: false
  - id: D5
    description: "batchArgumentsFor() is the single definition of an inner call's effective arguments, with both assertAnnoBatch() and dispatchBatchExecute() calling it (probe/encoding)"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && grep -c 'assertAnnoBatch(call.arguments' anno-tools.ts  # prints 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "A chain of ANNO_MAX_BATCH_DEPTH + 2 nested batch payloads is still refused BY NAME, naming the cap, with nothing executed -- and the override discipline and recursive allow-list still bite at depth"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index"
        status: pass
    human_judgment: false
  - id: D7
    description: "anno_save_project reads the store revision exactly once, so its revision field and its prose can never name different revisions (WR-10)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE"
        status: pass
    human_judgment: false
  - id: D8
    description: "A nested batch validates before any store handle is opened and executes against ONE already-open handle, so an interrupted batch leaves no partially-validated state on disk (probe/concurrency, backstop)"
    requirement: "MCP-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible"
        status: pass
    human_judgment: true
    rationale: "Carried as a backstop truth in the plan. The pre-existing test proves nothing executes when pre-validation refuses, and the new depth-2 allow-list case extends it to nesting, but genuine mid-batch INTERRUPTION (process death between the phases) is not exercised by any automated test and needs a human to judge whether the two-phase structure is sufficient evidence."

duration: 24 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 13: Read-Verb Agreement and Batch Phase Agreement Summary

**`anno_disassemble` now refuses an out-of-image address exactly as `anno_read_region` does, a nested `anno_batch_execute` on the documented store inheritance finally validates and executes, and `anno_save_project` reads its revision once.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-30T10:36:00Z
- **Completed:** 2026-08-30T11:00:28Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **Gap 1 (CR-01) closed.** `sliceSpan()` is total over every `(start, end)` pair — the guard now covers an inverted span alongside the low and high bounds — and `dispatchDisassemble()` slices on the span the caller named instead of one narrowed to the image's last address first. The two read verbs are now structurally identical in their refusal decision: each calls `sliceSpan()` once over the span its own answer reports, and each reaches the same `outsideImage()` builder.
- **Gap 4 (CR-06) closed.** `assertAnnoBatch()` recurses on `batchArgumentsFor(args, call)`, matching `dispatchBatchExecute()`'s own recursion. `batchArgumentsFor()` is now the single definition of an inner call's effective arguments, with two callers in the validator and one in the executor. `ANNO_MAX_BATCH_DEPTH` has a reachable positive control for the first time.
- **WR-10 closed.** `dispatchSaveProject()` hoists `currentRevision(handle)` to one `const` feeding both the returned field and the note's prose.
- **Ten new tests**, all driven through `runAnnoTool()` rather than the internal dispatchers, so every shape asserted is the one an agent actually receives.

### The exact before/after, as the plan asked

**`anno_disassemble {address: 36864}`** against a `.prg` loading at `$1000` with four payload bytes (last address `$1003`), captured by running the pre-fix module (`git show HEAD~2:…`) and the post-fix module side by side:

BEFORE — `isError: false`:
```json
{
  "image": "/tmp/probe-CTMVVO/tiny.prg",
  "origin": 4096,
  "address": 36864,
  "end_address": 4099,
  "instructions": 0,
  "listing": "!cpu 6510\n* = $9000"
}
```
An `end_address` of 4099 sits 32765 bytes *below* the `address` of 36864 it claims to answer about.

AFTER — `isError: false`:
```json
{
  "available": false,
  "reason": "anno_disassemble was asked for $9000..$1003, which is not entirely inside the image: \"/tmp/probe-zhaKnj/tiny.prg\" loads at $1000 and ends at $1003. Reported as unanswerable rather than served as a short slice, because a partial answer to a range question reads as a complete answer to a smaller one. Narrow the range, or name the image that actually covers those addresses."
}
```

**The depth-1 nested batch** (top-level `store`, inner batch naming none, leaf `anno_set_label_name`):

BEFORE — `isError: true`:
```
anno_batch_execute failed: [AnnoToolArgumentError] anno_set_label_name refused (calls[0]): "store" must be a
non-empty string naming an annotation store -- every anno_* verb names its own store (D-06), because there is
no ambient current store to inherit.
```
The refusal states the exact opposite of the tool's own description, which promises the store is named once at the top level and every inner call inherits it.

AFTER — `isError: false`, `failed: 0`, `results[0].status: "success"`, and the label lands in the top-level store two levels down.

**`md5sum docs/tool-support.md`:** `bb4744890855e58887142e5a97f44fc0` — unchanged, byte-identical after regeneration, confirming the `anno_batch_execute` description edit reaches neither manifest.

## Task Commits

1. **Task 1 (tracer, TDD): the two read verbs give the SAME verdict** — `2e9940a` (test, RED) → `e53b8cc` (fix, GREEN)
2. **Task 2 (TDD): batch validates and executes on the SAME arguments** — `da3b8e0` (test, RED) → `a57cc5c` (fix, GREEN)
3. **Task 3 (TDD): the save verb reads its revision once** — `edef4ac` (test, RED) → `bdbc089` (fix, GREEN)

No REFACTOR commits were needed — each GREEN was already in its final shape.

## Files Created/Modified

- `src/mcp/vice/anno-tools.ts` — `sliceSpan()` made total; `dispatchDisassemble()` de-narrowed; `outsideImage()` given the agreement rationale; `assertAnnoBatch()` recursing on effective arguments; `anno_batch_execute`'s description corrected to state that inheritance propagates through nesting; `dispatchSaveProject()` reading the revision once.
- `src/mcp/vice/anno-tools.test.ts` — ten new cases across three headings (CR-01, CR-06, WR-10).

## Decisions Made

1. **Test C was rewritten, not forced.** The plan predicted that a caller-named `end_address` below the start would reach `sliceSpan()` and be served as an empty-slice success. It does not: `anno-types.ts`'s shared range-shape validator already refuses a transposed range for **both** verbs with `AnnoRangeShapeError` (`endInclusive N is below start M`), before any byte is indexed. The plan's prediction about the surface was wrong; the underlying property it wanted was not. The test now pins **both** layers — the caller-named case refused identically on both verbs, and the *derived*-end inverted span that no argument validator can see.
2. **The inverted-span guard was kept regardless**, because it is genuinely load-bearing rather than defence-in-depth. For `{address: 36864}` with an omitted `end_address`, `requestedEnd` is derived as the image's last address (4099), so the resolved `from` is 32768 and `to` is 3: **both** existing bound checks pass (`from` is non-negative, `to` is inside the body) and only `from > to` catches it. That is the exact route the reported defect took.
3. **WR-10's RED came from a structural pin.** The behavioural pin (field equals the revision named in the prose) passes before *and* after the fix, because two sequential reads in a single-threaded run agree by accident. That accident is the finding, so the RED is carried by a source-level pin that `currentRevision(` appears exactly once in `dispatchSaveProject()`.
4. **The tracer gate ran in autonomous form.** Task 1 is `type="tracer"`, and the executor protocol routes an interactive run to a `checkpoint:human-verify` after the tracer commit. This plan carries `autonomous: true`, was dispatched autonomously by the orchestrator into a worktree, and the tracer's `<verify>` is fully automated, so the gate was satisfied by re-running that verify end-to-end (48/48 green) with a standing instruction to HALT before any expansion task on failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` absent in the worktree, so `npm run typecheck` could not run**

- **Found during:** Task 1 (acceptance criteria gate)
- **Issue:** `node_modules/` is gitignored and never committed, so the fresh worktree had none and `tsc` was not found. `npm run typecheck` is an acceptance criterion of Task 3 and a plan-level verification gate.
- **Fix:** Symlinked the main checkout's existing `src/mcp/vice/node_modules` into the worktree. **No package-manager install was run** — no `npm install`, no `npm ci`, no new or changed dependency, so the package-legitimacy gate was not triggered.
- **Files modified:** None tracked. The symlink was never staged (git's `node_modules/` pattern is directory-only, so it showed as untracked rather than ignored) and was **removed** after the last verification run; the working tree is clean.
- **Verification:** `npm run typecheck` exits 0; `git status --short` is empty.
- **Committed in:** Nothing — deliberately not committed.

**2. [Rule 1 - Bug in the plan's own test spec] Test C asserted the wrong layer**

- **Found during:** Task 1 (GREEN)
- **Issue:** As written from the plan, Test C asserted `available:false` for a caller-named inverted span on both verbs. That span is refused *upstream* with `isError:true` / `AnnoRangeShapeError`, so the test failed against correct behaviour.
- **Fix:** Rewrote the case to pin what actually holds and what the plan actually wants — identical refusal on both verbs at the validator layer, **plus** the derived-end inverted span that only `sliceSpan()` catches — and added a structural pin that the three-case guard cannot be dropped as redundant.
- **Files modified:** `src/mcp/vice/anno-tools.test.ts`
- **Verification:** 54/54 green; the substantive property (`sliceSpan()` is total, and both verbs agree) is asserted more strongly than the original spec would have.
- **Committed in:** `e53b8cc`

**3. [Rule 2 - Missing critical] `anno_batch_execute`'s description did not state that inheritance propagates through nesting**

- **Found during:** Task 2 (action step 3, which asks for exactly this review)
- **Issue:** The description promised top-level store inheritance but said nothing about nesting — a sentence that was safe only while the nested route was unreachable. With the route now working, a caller needs to know inheritance reaches a batch inside a batch.
- **Fix:** Extended the description to say inheritance applies "INCLUDING through nesting" and that an inner `store` is overridden "at every depth".
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `docs/tool-support.md` regenerates byte-identical (`bb47448…`), confirming `anno_*` names reach neither manifest; the batch advertisement test still passes.
- **Committed in:** `a57cc5c`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug in the plan's test spec, 1 missing critical). **Impact:** No scope creep — every fix stayed inside the two files the plan declared. The Test C correction strengthened the assertion rather than weakening it, and is called out explicitly because a silently relaxed test would be indistinguishable from a defect left in place.

## Issues Encountered

**One failing file on the automated arm, not attributable to this plan.** `npm run test:automated` reports 2681 pass / 1 fail out of 2688. The single failure is:

```
repo-root.test.ts:178  path agreement (D-3, D-6, THE regression this task exists to catch)
  the agreed directory must not sit under .claude -- got
  /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a8941a55c8fdaec82/.vice-supervisor
```

This is a **worktree-location artefact**: the test asserts that the resolved supervisor directory does not sit under `.claude`, and GSD's worktree isolation places this entire checkout at `.claude/worktrees/agent-…`. The assertion message names the cause verbatim. `git diff --name-only f16d0b1..HEAD` returns only `anno-tools.ts` and `anno-tools.test.ts` — `repo-root.ts` and `repo-root.test.ts` were not touched. It should be re-measured from the merged main checkout, where the path precondition holds.

Per `29-BASELINE.md`'s rule, the comparison target is the failing-file SET, and the set this phase closed at was EMPTY. Both files named in that expectation are confirmed green here: `audit-integrity.test.ts` **44/44** and `docs-review-disposition.test.ts` **7/7**.

## Verification Results

| Gate | Result |
|---|---|
| `node --test anno-tools.test.ts` | **54/54 pass**, 0 fail (was 42 before this plan; 12 added, 2 of them beyond the plan's ten) |
| `npm run typecheck` | exit 0, clean |
| `npm run test:automated` | 2681/2688 pass; failing set `{repo-root.test.ts}` — worktree-location artefact, see above |
| `node scripts/audit-gate.mjs` | exit 0 — 9 docs guards green, 7 milestone audits scanned |
| `node scripts/check-no-regenerator2000.mjs` | exit 0 — "0 temporarily allow-listed across **0 entries**" |
| `md5sum docs/tool-support.md` after regeneration | `bb4744890855e58887142e5a97f44fc0` — unchanged |
| `grep -c 'Math.min(requestedEnd' anno-tools.ts` | **0** |
| `grep -c 'assertAnnoBatch(call.arguments' anno-tools.ts` | **0** |
| `currentRevision(` inside `dispatchSaveProject()` | **1** |
| `grep -n 'anno-tools' module-classification.ts` (verification item 8, re-measured) | one path-only `supersededBy` line, no line citation — no citation update needed, confirming the file's absence from `files_modified` |

## Existing Tests Converted

**None.** The plan anticipated that some existing case might assert the narrowed success — a disassemble over a caller-named span the image does not fully cover. No such case existed. The nearest candidates were checked and are unaffected:

- `"ONE cap governs BOTH views…"` calls `anno_disassemble {address: "$c000", end_address: "$c008"}` against a 7-byte image, but under an 8-byte cap override, so it is refused by `assertWithinRegionCap()` *before* any slicing — a cap assertion, not a narrowing assertion.
- `"anno_disassemble decodes at an EXPLICIT address…"` uses a span wholly inside the image.

No test was deleted, and none was weakened.

## Known Stubs

None. No stub, placeholder, `TODO`, `FIXME`, skipped test or unrun `<verify>` was introduced by this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. The change set narrows behaviour (more refusals on the read verbs) and widens one documented, capped, allow-listed route (nested batch inheritance) whose recursive curated-name check and depth cap are both re-pinned by new tests.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gaps 1 and 4 of the phase verification are closed; MCP-04's two reproduced defects are repaired and pinned.
- **Explicitly still open**, exactly as the plan scoped them: WR-01, WR-02, WR-04, WR-06, WR-11, WR-12 (all `anno-*` warnings needing their own design decision), WR-03 (`anno-derive.ts`, the string `"false"` enabling a corpus) and WR-05 (`anno-tools.ts:407-426`, schema says workspace-relative while resolution is against the process working directory — fails safe, and its correct fix is a schema-text decision). WR-09 remains deferred to Phase 30 by the verification itself.
- **One item for the orchestrator:** re-run `repo-root.test.ts` from the merged main checkout to confirm the single automated-arm failure is the worktree-location artefact analysed above and not a real regression. It cannot be measured from inside a worktree.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*

## Self-Check: PASSED

- **Files:** `src/mcp/vice/anno-tools.ts`, `src/mcp/vice/anno-tools.test.ts` and
  `.planning/phases/29-the-mcp-surface/29-13-SUMMARY.md` all present on disk.
- **Commits:** all seven recorded hashes (`2e9940a`, `e53b8cc`, `da3b8e0`,
  `a57cc5c`, `edef4ac`, `bdbc089`, `d3b2c59`) present in
  `git log f16d0b1..HEAD`.
- **Acceptance criteria re-run:** `Math.min(requestedEnd` → 0;
  `assertAnnoBatch(call.arguments` → 0; `currentRevision(` inside
  `dispatchSaveProject()` → 1; `node --test anno-tools.test.ts` → 54/54;
  `npm run typecheck` → exit 0.
- **Plan-level verification re-run:** `audit-gate.mjs` exit 0;
  `check-no-regenerator2000.mjs` exit 0 with 0 entries;
  `docs/tool-support.md` md5 `bb4744890855e58887142e5a97f44fc0` unchanged.
- **Deletions:** `git diff --diff-filter=D` over the branch is EMPTY, so the
  branch does not trip `cleanup-wave`'s deletion refusal.
- **Working tree:** clean; the temporary `node_modules` symlink was removed and
  never staged.
- **Shared artefacts:** `STATE.md` and `ROADMAP.md` untouched (worktree mode —
  the orchestrator owns those writes).
