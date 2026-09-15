---
phase: 50-equivalence-and-modifiability
plan: 04
subsystem: vice-mcp
tags: [text-monitor, load-route, allowlist, tracer-slice, checkpoint-decision]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability (plans 01, 02)
    provides: the narrowed volatile mask and compare-cross-binary.mjs this plan's live half will calibrate
provides:
  - "A recorded, developer-approved load-route decision (route-d): the text monitor's own `load` command, not one of the plan's three offered routes"
  - "A narrowly-scoped, tested widening of text-protocol.ts's TEXT_COMMAND_ALLOWLIST/TEXT_COMMAND_PARAM_SPECS for the read-direction `load` verb, with the write-direction `save` refusal still proven"
affects: ["50-04 live half (Tasks 2/3, not executed here)", "50-05", "50-06"]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A file-touching-verb allowlist entry can bake a reviewed, fixed filename into its own frozen verb identity. It can reuse the existing single-bounded-numeric-parameter mechanism unchanged, rather than inventing a string-typed parameter kind."

key-files:
  created:
    - .planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md
  modified:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    # Continuation (2026-09-15, offline half continued): the vice_program_load
    # tool that reaches the load widening above through the normal vice_*
    # surface -- see "## Continuation" section below.
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/stock-derived.ts
    - src/mcp/vice/stock-derived.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "The developer answered Task 1's checkpoint:decision with a fourth route (route-d, the text monitor's own `load` command). The plan did not offer this route. The developer also chose to widen text-protocol.ts's allowlist for it, rather than reject the route once the existing refusal was discovered."
  - "The load widening bakes the committed hazard-subject fixture's absolute path into the verb's own identity. It never accepts a caller-supplied string. It exposes only the device number as a bounded numeric parameter, reusing the existing 'count' kind unchanged. No new TextCommandParamKind and no string-typed parameter exist."
  - "The two narrowed guard-test assertions still prove that `save` (the write direction) is refused everywhere, including across the new TEXT_COMMAND_PARAM_SPECS key. Only the read direction moved."

requirements-completed: []  # EQUIV-01/EQUIV-02 are NOT complete -- see status below. The live half (Tasks 2/3) that actually proves them has not run.

coverage:
  - id: D1
    description: "Task 1's checkpoint:decision, recorded in LOAD-ROUTE.md. Names one chosen route (route-d), dated. Names the developer's rationale and a rejection reason for each of the three routes not chosen."
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "text-protocol.ts's TEXT_COMMAND_PARAM_SPECS gains one narrowly-scoped, tested `load` entry. text-protocol.test.ts's two guard assertions are narrowed, not deleted. A passing test still proves the save/file-writing refusal."
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-protocol.test.ts#isAllowlistedTextCommand: accepts every TEXT_COMMAND_ALLOWLIST entry and rejects an arbitrary string"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/text-protocol.test.ts#TEXT_COMMAND_ALLOWLIST: every entry is exactly one of the eleven named verbs, and every allowlisted or parameterized verb (including the plan 50-04 `load` widening) still refuses a file-WRITING monitor verb (T-41-02)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/text-protocol.test.ts#buildTextCommand [load, plan 50-04]: renders the exact command form VICE's own upstream grammar documents for device 0, host-filesystem read"
        status: pass
    human_judgment: false
  - id: D3
    description: "Task 2 (one binary, end to end -- load, checkpoint, capture, digest, transcript) -- NOT executed"
    verification: []
    human_judgment: true
    rationale: "This is a live task. It requires mcp__vice__* tools and a real running stock VICE instance. This executor had no such tools. The orchestrator's own instructions scoped this executor to halt before any live capture."
  - id: D4
    description: "Task 3 (calibrate the narrowed mask against two runs of the same binary) -- NOT executed"
    verification: []
    human_judgment: true
    rationale: "This task depends on Task 2's captures. Task 2 has not run. This is also a live task, out of scope for this executor for the same reason as D3."
  - id: D5
    description: "Continuation (2026-09-15, offline half continued): a new shipped MCP tool, vice_program_load, reaches text-protocol.ts's widened load verb through the normal vice_* dispatch seam. It takes one optional, bounded device number (0-11, default 0). It takes no filename argument. The committed hazard-subject fixture path stays baked into the verb's own frozen identity."
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-tools.test.ts#handleProgramLoad: renders buildTextCommand()'s exact rendering for the default device and for a supplied device. It holds the text-channel lock for the duration. It refuses an out-of-range device by name, via buildTextCommand's own message, with no lease resolved. It ignores an injected filename-shaped argument."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-dispatch.test.ts#conformanceTest(\"vice_program_load\"): dispatchStock() answers. Its answer validates against tools-manifest.stock.json's own declared outputSchema. The file's own D-02 completeness guard requires this case once a manifest entry exists."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-derived.test.ts, src/mcp/vice/hostpath-consumers.test.ts: vice_program_load is registered in STOCK_DERIVED_TOOLS (needsSession:false). It is also registered in DERIVED_TOOL_MODULES (text-tools.ts). D-05-12's existing enforcement therefore covers it: no derived-tool module may import hostpath.ts."
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-15
status: halted
---

# Phase 50 Plan 04: Load-Route Decision and Allowlist Widening (Offline Half) Summary

**Recorded the developer's route-d load-route decision and implemented the resulting text-protocol.ts allowlist widening. The plan's two live capture tasks remain unexecuted.**

## Performance

- **Duration:** 55 min (approximate -- offline half only)
- **Completed:** 2026-09-15
- **Tasks:** 2 of 3 plan tasks addressed. Task 1 is complete. Tasks 2 and 3 are explicitly out of scope (see below).
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Task 1 carries a `checkpoint:decision` with a blocking-human gate. `LOAD-ROUTE.md` now records the answer. The developer chose a fourth route, `route-d` (the text monitor's own `load` command over `-remotemonitor`). The plan did not offer this option. The developer separately decided to widen the allowlist for it, once the plan found the existing refusal.
- `text-protocol.ts` gained a single, narrowly-scoped `TEXT_COMMAND_PARAM_SPECS` entry for `load`. Its verb string bakes the committed `hazard-subject.prg` fixture's absolute path into its own frozen identity, resolved via `repoRoot()`. No caller can supply that string. The entry takes only the device number as a bounded numeric parameter (kind `"count"`, 0 through 11). It reuses the existing render and round-trip mechanism unchanged.
- `text-protocol.test.ts`'s two guard assertions this reverses are narrowed, not deleted. The tests still prove the `save` (write-direction) refusal, now across both `TEXT_COMMAND_ALLOWLIST` and `TEXT_COMMAND_PARAM_SPECS` keys. New positive assertions prove the one reviewed `load` verb is dialable. An arbitrary caller-chosen filename is still not.
- `npm run typecheck` reports no errors. `npm run test:automated` passes 3655 of 3655 tests, with 9 skipped (the documented `MANUAL_ONLY_TESTS` floor).

## Task Commits

Each task was committed atomically:

1. **Task 1: Decide how a committed .prg reaches the running emulator (record the decision)** - `10cb7e83` (docs)
2. **Deviation: widen text-protocol.ts's allowlist for the load verb (route-d)** - `f57f2595` (feat)
3. **Continuation (2026-09-15): add the `vice_program_load` shipped MCP tool** - `494b512c` (feat)

**Plan metadata:** committed together with this SUMMARY (see below).

## Files Created/Modified

- `.planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md` - Task 1's recorded decision. Names route-d as chosen. Names routes a/b/c as rejected, with reasons. Quotes the developer's rationale.
- `src/mcp/vice/text-protocol.ts` - Adds the `HAZARD_SUBJECT_PRG_PATH` constant (an absolute path via `repoRoot()`). Adds one new `TEXT_COMMAND_PARAM_SPECS` entry for `load`. Adds dated widening-rationale comments in the same voice as the `prof on/off`/`memmapzap` precedents.
- `src/mcp/vice/text-protocol.test.ts` - Narrows two guard assertions (still refuses `save`, now also proves `load` is dialable). Adds one new fixture-free `buildTextCommand` test, sourced from VICE's own upstream grammar and manual. Adds one new positive-control assertion to the array-driven canonical-rendering test.

## Decisions Made

- The developer's checkpoint answer named a route (`route-d`) outside the plan's three options. The plan then surfaced the existing refusal. The developer explicitly chose to widen the allowlist for it, rather than fall back to one of the three offered routes. See `LOAD-ROUTE.md` for the full rationale and the three rejection reasons.
- The load verb's filename is never a caller-supplied parameter. It is baked into the verb's own frozen identity as a reviewed literal. This keeps `text-protocol.ts`'s existing "no string-typed parameter" design principle fully intact. That principle is a separate invariant from the load/save refusal this plan's decision reverses.
- The command syntax is `load "<filename>" <device> [<address>]`, where device 0 means "host filesystem". This comes from VICE's own `mon_parse.y` grammar and `vice.texi` manual, both found in a vendored VICE 3.8 checkout on this host. No live capture produced this syntax. This executor authored the widening without ever connecting to a running emulator, exactly as scoped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 / Rule 1 hybrid -- developer-directed, not autonomous] Widened `src/mcp/vice/text-protocol.ts` and `src/mcp/vice/text-protocol.test.ts`, outside plan 50-04's declared `files_modified`**
- **Found during:** Task 1 (recording the developer's checkpoint answer)
- **Issue:** The developer's route-d decision named a load route the plan never anticipated. Reaching it required reversing part of a committed, tested invariant, in a file the plan's `files_modified` list does not mention.
- **Fix:** Added one narrowly-scoped `TEXT_COMMAND_PARAM_SPECS` entry for `load` (device-number parameter only, filename baked into the verb's own frozen identity via `repoRoot()`). Narrowed, never deleted, the two guard-test assertions this reverses. Added new tests that prove both the narrow widening and the surviving `save` refusal.
- **Files modified:** `src/mcp/vice/text-protocol.ts`, `src/mcp/vice/text-protocol.test.ts`
- **Verification:** `npm run typecheck` reports no errors. `node --test text-protocol.test.ts` passes 35 of 35 tests, on two separate runs. `npm run test:automated` passes 3655 of 3655 tests on a clean rerun (see "Issues Encountered" for one unrelated, pre-existing flake on the first run).
- **Committed in:** `f57f2595`

This deviation is the direct, authorized consequence of the developer's answered checkpoint (see `<deviation_note>` in this executor's own instructions). It is not autonomous scope creep.

---

**Total deviations:** 1 (developer-directed widening spanning two files).
**Impact on plan:** Necessary to record and implement the developer's actual decision. No speculative widening goes beyond what route-d requires. The entry is scoped to the one committed tracer-slice fixture. This plan introduces no free-text filename parameter.

## Issues Encountered

- One run of the full `npm run test:automated` suite showed a single failure. `Control 2 (planted RED, without the fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the real output`, in `text-protocol.test.ts`, is a pre-existing, timing-sensitive planted-RED test. It is unrelated to this plan's changes. It asserts a race between a 0ms quiescence window and a 15ms delayed write. An immediate rerun of the same suite passed cleanly (3655 of 3655). Two isolated standalone runs of `text-protocol.test.ts` alone also passed cleanly (35 of 35 each). This is a pre-existing scheduling-jitter flake under heavy parallel CPU load. It is not a regression this plan introduced.

## User Setup Required

None - no external service configuration required.

## Continuation (2026-09-15): the `vice_program_load` tool

A second, offline-only executor continued this halted plan. Its one job: expose the
already-widened text-channel `load` verb (see Task 1 and the deviation above) as a
shipped MCP tool. This lets a later live executor reach it through the normal
`vice_*` surface, instead of route 2 below. This continuation ran no `mcp__vice__*`
tool. It attempted no live capture. Tasks 2 and 3 remain exactly as unexecuted as
before.

**What it added**, following `handleIoRegisters`'s own pattern (route 1 named in the
prior version of this section, below):

- `src/mcp/vice/text-tools.ts`: `handleProgramLoad()`, registered as `vice_program_load`.
  It takes exactly one optional argument, `device` (bounded 0-11, default 0 when
  omitted). It takes NO filename argument. `buildTextCommand()` alone validates and
  bounds the device. The handler duplicates no bound. It dials inside
  `withTextTool(...)`. It takes the text channel's own lock via
  `withTextChannelLock()`, around exactly one `client.command()`, matching every
  sibling handler in the file.
- `src/mcp/vice/stock-dispatch.ts`: registered with `withDerivedTool("vice_program_load",
  { needsSession: false }, handleProgramLoad)`. This is the same adapter its five
  text-channel siblings use.
- `src/mcp/vice/stock-derived.ts`: added to `STOCK_DERIVED_TOOLS`.
- `src/mcp/vice/tools-manifest.stock.json`: added a `vice_program_load` entry. Input
  schema: one optional bounded `device` integer, no filename property anywhere.
  Output schema: `command`, `device`, `response`, `note`, `runState`.
- Tests: `src/mcp/vice/text-tools.test.ts` gained five new cases. They prove the
  rendered command for the default and a supplied device. They prove the
  channel-lock hold. They prove the out-of-range refusal, via `buildTextCommand`'s
  own message, with no lease resolved. They prove an injected filename-shaped
  argument never reaches the dialed command. `src/mcp/vice/stock-dispatch.test.ts`
  gained a `conformanceTest("vice_program_load", ...)` case, required by that file's
  own D-02 completeness guard once a manifest entry exists, plus a
  `STOCK_ONLY_TOOLS` entry. `src/mcp/vice/stock-derived.test.ts` and
  `src/mcp/vice/hostpath-consumers.test.ts` were updated for the new registered
  count and the new `DERIVED_TOOL_MODULES` mapping (`vice_program_load` ->
  `text-tools.ts`). Both files' own existing completeness assertions required this
  update.
- **Verification:** `npm run typecheck` reports no errors. `npm run test:automated`
  passes 3661 of 3661 non-skipped tests. 9 tests are skipped -- the documented
  `MANUAL_ONLY_TESTS` floor. There are 0 failures.

**Restart requirement, stated plainly:** an already-running MCP server process reads
`tools-manifest.stock.json` once. It reads the file offline, at startup. It answers
every later `tools/list` request from that one load (this project's own "Advertised
tool surface" component description). Adding `vice_program_load` to the manifest and
to the dispatch table does NOT make an already-running server advertise or dispatch
it. A live executor picking up Task 2 needs a FRESH MCP server session. That means a
fresh process, started after this continuation's commit. Only then is
`vice_program_load` reachable at all. A session already open when this commit
landed will not see the new tool, no matter how long it keeps running.

## Live half -- not executed (Tasks 2/3 themselves)

**What remains:** Plan 50-04's Tasks 2 and 3 have not been executed.

- **Task 2** ("One binary, end to end -- load, checkpoint, capture, digest, transcript") requires a live executor to start a genuine stock VICE instance. That executor must load the committed `hazard-subject.prg` through the now-widened `load` verb. It must arm and hit a real execute checkpoint at `hazard_raster_entry`. It must capture a full 64K RAM image plus a chip-state sidecar, and write `docs/phase50-equivalence-transcript.md`'s capture-procedure section from the literal commands it actually ran.
- **Task 3** ("Calibrate the narrowed mask against two runs of the same binary") repeats Task 2's procedure from a fresh emulator start. It then runs the cross-binary comparison. It cannot start until Task 2's captures exist.

Both tasks need `mcp__vice__*` tools: `vice_checkpoint_add`, `vice_execution_run`, `vice_ping`, `vice_snapshot_save`, `vice_vicii_get_state`, `vice_sprite_get`, `vice_registers_get`, `vice_checkpoint_delete`, `vice_checkpoint_list`, and a way to dial the widened `load` command itself. Neither this plan's original executor nor this continuation had any of these tools. Both were explicitly forbidden from attempting, synthesizing, fabricating, or simulating any live capture, and neither did. No capture artifact, transcript, or checkpoint-address claim exists anywhere in this plan's output. Nothing exists beyond what Task 1, the code widening, and this continuation's tool addition required.

**Does reaching the widened `load` verb need a new shipped MCP tool?** Yes, if the live task goes through the normal `vice_*` tool surface. As of this continuation, that tool now exists: `vice_program_load`. A second route remains available and is named below for completeness. It is no longer the only option.

Concretely, the two routes named in the original version of this section were:

1. A new, narrowly-scoped tool handler in `text-tools.ts`, following the exact `handleIoRegisters` pattern. **This continuation added it** (`handleProgramLoad`, registered as `vice_program_load` -- see "## Continuation" above for the full detail). Whoever executes Task 2 still needs a fresh MCP server session for it to be reachable at all (see the restart requirement stated above).
2. Driving `text-connect.ts`/`text-protocol.ts` directly, in-process, from a committed Node script, never through the MCP tool surface. This project's own `c64-ram-capture` skill scripts, and `text-protocol.test.ts` itself, already call `TextMonitorClient`/`textConnect()` directly this way. This route remains available and untouched by this continuation. A live executor may still choose it instead of `vice_program_load`, if that is otherwise preferable.

## Next Phase Readiness

- The load-route decision is settled and recorded. The allowlist widening it requires is implemented, tested, and committed.
- Tasks 2 and 3 of this plan remain blocked. So do plans 50-05 and 50-06, which depend on this plan's captures and transcript. All of them need a live executor with `mcp__vice__*` tool access, to complete the work described in "Live half -- not executed" above.
- The `vice_program_load` tool now exists in the shipped tool surface (this continuation). A live executor still needs a FRESH MCP server session, started after this continuation's commit, before that tool is reachable. See "Restart requirement, stated plainly" above.
- This SUMMARY uses `status: halted`, not `complete`, deliberately. This is an intentional, designed halt at the live-capture boundary. It is not a finished plan. Treat any later plan whose `depends_on` names `50-04` as blocked. A live executor must first complete Tasks 2/3. This SUMMARY, or a follow-up one, must then be re-marked `complete`.

## Self-Check: PASSED

- `[ -f .planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md ]` → FOUND
- `[ -f src/mcp/vice/text-protocol.ts ]` and `[ -f src/mcp/vice/text-protocol.test.ts ]` → FOUND (both modified, verified via `git diff --stat`)
- `git log --oneline --all --grep="50-04"` → returns both task commits (`10cb7e83`, `f57f2595`)
- `npm run typecheck` → PASS (no errors)
- `node --test text-protocol.test.ts` → 35 of 35 PASS (run twice)
- `npm run test:automated` → 3655 of 3655 PASS on a clean rerun (see "Issues Encountered" for the one unrelated transient flake on the first run)

### Continuation self-check (2026-09-15): PASSED

- `[ -f src/mcp/vice/text-tools.ts ]`, `[ -f src/mcp/vice/stock-dispatch.ts ]`, `[ -f src/mcp/vice/stock-derived.ts ]`, `[ -f src/mcp/vice/tools-manifest.stock.json ]` → FOUND (all modified, verified via `git diff --stat`)
- `grep -n "vice_program_load" src/mcp/vice/tools-manifest.stock.json src/mcp/vice/stock-dispatch.ts src/mcp/vice/stock-derived.ts` → each file names the new tool
- `npm run typecheck` → PASS (no errors)
- `node --test text-tools.test.ts stock-dispatch.test.ts` → 184 of 184 non-skipped tests PASS, 1 skipped (a pre-existing opt-in live case)
- `npm run test:automated` → 3661 of 3661 non-skipped tests PASS, 9 skipped (the documented `MANUAL_ONLY_TESTS` floor), 0 failures
- `git log --oneline -1` → this continuation's own commit (see "Task Commits" below)

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15*
