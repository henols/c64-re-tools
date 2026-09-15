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
  # Added 2026-09-15 by the live half (Tasks 2/3):
  - "Two committed 64K captures of the hazard-subject at hazard_raster_entry, each with a chip-state sidecar, taken on genuine unpatched stock /usr/bin/x64sc (VICE 3.9)"
  - "docs/phase50-equivalence-transcript.md -- the phase's evidence of record, with the capture procedure and the mask calibration both written from literal runs"
  - "A reusable capture driver (evidence/capture-run.mjs) and sidecar builder (evidence/make-sidecar.mjs) that every later live task in this phase repeats without change"
  - "A calibrated, and in the event UNCHANGED, volatile mask: compare-cross-binary-mask-v1 is closed from this point on"
affects: ["50-05", "50-06", "50-07"]  # updated 2026-09-15: the live half (Tasks 2/3) is now executed, so these three are unblocked

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 2
# Live half (2026-09-15), recorded separately rather than folded into the
# numbers above, so the halted half's own actuals stay readable:
actuals_live_half:
  tasks: 2      # plan Tasks 2 and 3
  commits: 2    # 700c147a, 786ec221

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A file-touching-verb allowlist entry can bake a reviewed, fixed filename into its own frozen verb identity. It can reuse the existing single-bounded-numeric-parameter mechanism unchanged, rather than inventing a string-typed parameter kind."

key-files:
  created:
    - .planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md
    # Live half (2026-09-15, Tasks 2/3):
    - .planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs
    - .planning/phases/50-equivalence-and-modifiability/evidence/make-sidecar.mjs
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-b.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-b.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-a.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-a.log.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-b.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-b.log.json
    - docs/phase50-equivalence-transcript.md
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

requirements-completed: []  # DELIBERATE, and re-checked after the live half ran (2026-09-15).
  # The live half is now complete, and it still does not PROVE either id, so neither is claimed.
  # EQUIV-01 asks for compare.mjs run in original-versus-DIFFERENT-binary mode. This plan ran
  #   compare-cross-binary.mjs for the first time on real captures, but both captures are of the
  #   SAME binary. The different-binary leg is exercised by 50-05 (red control) and 50-06.
  # EQUIV-02 asks for behavioural equivalence between the original and THE REBUILD. No rebuild has
  #   been captured or compared yet, so nothing here demonstrates it.
  # What this plan does provide is the instrument and the procedure both ids depend on.

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
    description: "Task 2 (one binary, end to end -- load, checkpoint, capture, digest, transcript) -- EXECUTED LIVE 2026-09-15 against genuine unpatched stock /usr/bin/x64sc (VICE 3.9). hazard_raster_entry resolved to $108F from a real ACME --symbollist run whose output is byte-identical to the committed .prg. Loaded by route-d, stopped at the checkpoint with PC = 4239, captured a 65536-byte image plus a 49-register chip-state sidecar, deleted the checkpoint and proved the deletion by enumeration (totalReported 0)."
    verification:
      - kind: command
        ref: "test \"$(stat -c %s .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin)\" = \"65536\""
        status: pass
      - kind: command
        ref: "node src/skills/c64-ram-capture/scripts/compare.mjs digest .../original-a.bin -> 0e3f47d6... 65536 bytes, exit 0"
        status: pass
      - kind: command
        ref: "grep -ac '^capture_route:\\|^checkpoint_name:\\|^mask_version:' docs/phase50-equivalence-transcript.md -> 3"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase50-equivalence-transcript.md '## Capture procedure' -- dated command lines and raw output excerpts from the literal runs, including the post-deletion checkpoint count of 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Task 3 (calibrate the narrowed mask against two runs of the same binary) -- EXECUTED LIVE 2026-09-15. A second independent capture from a fresh x64sc process. compare-cross-binary.mjs over both captures with --limit 0 reports volatile 0, allowlisted 0, DIVERGENCE 0, VERDICT: PASS. No unmasked difference existed, so the mask was neither narrowed nor widened, and no unexplained residual exists. The transcript records that the mask is closed from this point on."
    verification:
      - kind: command
        ref: "test \"$(stat -c %s .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-b.bin)\" = \"65536\""
        status: pass
      - kind: command
        ref: "grep -c 'Mask calibration' docs/phase50-equivalence-transcript.md -> 1"
        status: pass
      - kind: unit
        ref: "node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs -> tests 23, pass 23, fail 0"
        status: pass
      - kind: command
        ref: "node compare-cross-binary.mjs cross original-a.bin original-b.bin --state ... --checkpoint hazard_raster_entry --limit 0 -> VERDICT: PASS, total differing addresses 0, exit 0"
        status: pass
    human_judgment: false
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
status: complete
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
4. **Task 2: One binary, end to end -- load, checkpoint, capture, digest, transcript** - `700c147a` (feat)
5. **Task 3: Calibrate the narrowed mask against two runs of the same binary** - `786ec221` (docs)

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
- **SUPERSEDED 2026-09-15 (the three bullets above are kept as the record of the halt, not deleted).** The live executor ran. Tasks 2 and 3 are complete, the frontmatter now reads `status: complete`, and plans 50-05, 50-06 and 50-07 are unblocked. See "## Live half (2026-09-15)" below for what was actually measured. The one thing that did NOT change is `requirements-completed`, which stays `[]` on purpose: the live half proves neither EQUIV-01 nor EQUIV-02, for the reasons stated in that field's own comment.

## Live half (2026-09-15): Tasks 2 and 3 executed

A third executor picked this halted plan up and ran its two live tasks. The
records above are left exactly as they were written; this section is appended,
not substituted. Task 1 was not re-run and the recorded route-d decision was not
re-litigated.

**Instrument.** Genuine unpatched stock `/usr/bin/x64sc`, which reports `x64sc
(VICE 3.9)` and is owned by the Debian `vice` package. The absolute path is
load-bearing -- a fork build at `/usr/local/bin/x64sc` shadows it on `$PATH`,
so the broker was pinned with `VICE_BIN=/usr/bin/x64sc` and its own startup line
(`backend "stock" (binary: /usr/bin/x64sc)`) was read back to confirm the
pinning rather than assume it. The broker ran as a systemd user unit and was
stopped, with the shutdown verified four ways, before any test suite was run.

### The checkpoint address was measured, not transcribed

`acme --cpu 6510 -f cbm -o <out> --symbollist <sym> hazard-subject.a`, run
against the committed root, resolved `hazard_raster_entry = $108f` and
`entry = $80d`. The freshly assembled output is byte-identical to the committed
`hazard-subject.prg` (both sha256 `89846d48...`), so the symbol list describes
the binary that actually ran rather than a coincidentally similar one.

### The capture route actually taken

**Route 1 of the two this SUMMARY named -- `vice_program_load` through the live
MCP session -- was genuinely unavailable, exactly as the restart requirement
above predicted.** The session's MCP server process started before commit
`494b512c`, so the tool was not advertised and could not be called. This is a
confirmation of that prediction, recorded here because the prediction was made
before it could be tested.

**Route 2 was taken, in a form slightly stronger than the one described above.**
Rather than driving a raw `TextMonitorClient`, `evidence/capture-run.mjs` calls
`dispatchStock()` -- the project's own dispatch seam -- with the same deps shape
`vice-proxy.ts`'s `dispatchStockFor()` builds. Every emulator operation therefore
ran through exactly the shipped handler the identically-named MCP tool would
have run, `vice_program_load` included, because dispatch never consults the
manifest snapshot that a running server reads once at startup.

**A second, independent constraint forced the whole sequence into one process,
and it is the more important of the two.** The broker's release path is
kill-never-recycle: `handleRelease()` (`vice-broker.mts`) calls `verifiedKill()`
and `deleteInstanceRecord()` on the granted instance, and the connection *is*
the lease. A process that acquires a lease, loads a program and then exits
destroys the machine it just loaded into. A split "script loads, session
captures" flow can therefore never work here -- the second acquire receives a
freshly booted machine with no program in it. Anyone later tempted to split this
back into per-call MCP invocations will hit that, and it will look like the load
silently failing.

### What Task 2 measured

- The route-d load succeeded on the first attempt against stock VICE:
  `(C:$fd70) Loading '.../hazard-subject.prg' from 0801 to 10E7 (08E7 bytes)`.
  No filename was caller-supplied; the path is baked into the verb's frozen
  identity.
- The checkpoint armed at `$108F` (`id 1`, `start 4239`, exec, stop) and trapped
  with `hitCount 1`. The CPU registers read in the same paused window confirm it
  independently: `PC` is 4239.
- The checkpoint was deleted and the deletion proved **by enumeration**:
  `vice_checkpoint_list` returned `"checkpoints":[]`, `totalReported 0`,
  `entriesReceived 0`. The machine was resumed exactly once.
- `vice_snapshot_save` plus `vsf-slice.mjs slice` produced a 65536-byte image,
  sha256 `0e3f47d6...`. The `capture route` recorded in both sidecars is
  `snapshot`, and one route serves every capture in this phase.
- **Independent evidence the program RAN rather than merely loaded**, which
  byte-identity with the `.prg` would not have given: the captured image matches
  the `.prg` body everywhere except `$825`, and `$825` is `smc_patch_target` in
  the same symbol list -- the fixture's planted self-modifying construction,
  which has already modified itself by this checkpoint. The six bytes at `$108F`
  (`78 a9 b2 8d 14 03` = `SEI` / `LDA #$B2` / `STA $0314`) had not yet executed,
  so nothing was running under interrupt at the sample point. That is the
  structural reason this checkpoint is reproducible, and it is measured here
  rather than asserted.

### What Task 3 measured

Run B repeated the procedure without change, from a fresh emulator process
(21:01:30 against run A's 20:59:46, each with its own `XDG_CONFIG_HOME` scratch
directory; the prior instance was already killed on release).

`compare-cross-binary.mjs cross ... --checkpoint hazard_raster_entry --limit 0`
reported, in full:

```
BYTE_IDENTICAL: yes
volatile (excluded from the verdict): 0
allowlisted (intentional difference, excluded from the verdict): 0
DIVERGENCE — fails the comparison: 0
total differing addresses (image + register): 0
VERDICT: PASS
```

Not one of the 65536 image addresses differed, and not one of the 49 register
addresses both sidecars carry differed.

**Neither permitted resolution route was taken, because neither had anything to
act on.** ROUTE 1 (narrow the mask with a hardware reason): zero entries, no
mask span changed, added or deleted. ROUTE 2 (name an unexplained residual):
zero entries. `MASK_NARROWED_AT` still reads `compare-cross-binary-mask-v1`,
unchanged from plan 50-01.

**Stated without dressing up, because the result is easy to over-read.** A
comparison that finds nothing cannot distinguish "there was nothing to find"
from "the instrument cannot see". This PASS is evidence that the pipeline is
reproducible, not that it is sensitive; the red control in plan 50-05 is what
settles that. The byte-identity is also partly manufactured by the rig: every
instance is launched with `-seed 4242 -raminitstartrandom 0 -raminitrepeatrandom
0 -raminitrandomchance 0`, a deterministic RAM-init profile, and a pair taken
without those flags could reasonably differ in uninitialised RAM. The transcript
records the full argv for that reason.

The transcript records that **the mask is closed from this point on**: a later
difference is resolved by naming it in the allowlist with why it is intentional,
never by widening the mask.

## Deviations from Plan (live half, 2026-09-15)

### Auto-fixed Issues

**1. [Rule 2 - missing critical] Committed two evidence scripts the plan's `files_modified` does not list**
- **Found during:** Task 2
- **Issue:** The plan asks for a transcript carrying "the dated command lines
  actually run". The command lines that actually ran invoke a driver, and a
  driver living only in a scratch directory would make every command line in the
  transcript unreproducible -- the transcript would name a path that does not
  exist for any later reader.
- **Fix:** Committed `evidence/capture-run.mjs` (the capture driver) and
  `evidence/make-sidecar.mjs` (the sidecar builder) alongside the artifacts they
  produced, plus the raw per-run logs (`run-a`/`run-b` `.bundle.json` and
  `.log.json`) the transcript quotes from. Task 3's own action requires repeating
  Task 2's procedure "exactly", which a committed driver makes literally true
  rather than approximately true.
- **Files modified:** `.planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs`, `.../evidence/make-sidecar.mjs`, `.../evidence/captures/run-{a,b}.{bundle,log}.json`
- **Verification:** Both scripts ran to exit 0 twice each, producing the two
  committed captures and their two sidecars.
- **Committed in:** `700c147a`, `786ec221`

---

**2. [Rule 1 - bug] Two environment overrides were needed to start the broker, both surfaced as refusals by name**
- **Found during:** Task 2 (broker start)
- **Issue:** A systemd user unit's `PATH` resolves `/usr/bin/node` (v20.19.2),
  below the launcher's v24 floor, and resolves `/usr/local/bin/x64sc` (the fork
  build) ahead of the genuine stock binary.
- **Fix:** `VICE_BROKER_NODE=/home/henrik/.nvm/versions/node/v24.20.0/bin/node`
  and `VICE_BIN=/usr/bin/x64sc` on the unit. Both are documented overrides, and
  in both cases the shipped code refused by name with the remedy in the message
  rather than failing obscurely -- the launcher's own refusal text names
  `VICE_BROKER_NODE` explicitly. Nothing was installed and no code changed.
- **Verification:** The broker's own startup line reads `backend "stock" (binary:
  /usr/bin/x64sc)`, so the pinning is confirmed from the broker's report rather
  than inferred from `$PATH`.
- **Committed in:** recorded in the transcript's "Capture procedure" step 2; no
  code change to commit.

---

**3. [Rule 1 - bug] The sidecar's `registers` key: two committed contracts disagree on its shape**
- **Found during:** Task 2 (sidecar authoring)
- **Issue:** `c64-ram-capture/SKILL.md`'s `raw.json` step passes the decoded
  `vice_vicii_get_state` document through as `registers`.
  `compare-cross-binary.mjs`'s `normalizeRegisters()` reads `registers` as an
  address -> value map and refuses the whole sidecar by name when a key does not
  parse as an address. A sidecar satisfying the first is rejected by the second.
- **Fix:** The consumer's contract wins, because it is the one that actually
  executes and because the plan states outright that the comparison module reads
  the sidecar. `registers` is the address -> value map, decoded from
  `vice_vicii_get_state`'s own `registersHex` -- the literal register bytes the
  chip returned, not a re-derivation. Every field `raw.json` names is preserved
  unchanged under an explicitly named sibling key (`vicii_raw`, `sprites`, `cpu`,
  `port01_raw`, `dd00_raw`, `d018_raw`, `sprite_pointers`). Nothing is dropped.
  `make-sidecar.mjs`'s header records why, so a later reader does not "fix" it
  back into the refusal.
- **Verification:** `compare-cross-binary.mjs` loaded both sidecars and compared
  49 register addresses without refusing either.
- **Committed in:** `700c147a`

---

**Total deviations (live half):** 3 (1 committed-artifact widening, 1
environment configuration, 1 contract reconciliation).
**Impact on plan:** None adverse. No mask was touched, no tool surface was
widened, nothing was installed, and no plan prohibition was engaged.

## Issues Encountered (live half)

- **`vice_ping` is refused with `ECONNREFUSED` immediately after a grant.** The
  broker issues the grant as soon as it has *spawned* `x64sc`, which is before
  `x64sc` has bound its binary-monitor port -- measured as a connect refusal on a
  ping sent in the same second as the broker's own launch log line. The driver
  retries the first ping until the emulator answers (it answered on attempt 2,
  about 2 seconds later, in both runs). This is a booting machine, not a wedge,
  and `vice-wedge-triage`'s decision tree was not needed at any point in either
  run. Recorded because a future reader who sends one ping and concludes the
  instance is dead would be wrong.
- No epoch-drift error appeared during either capture, so both runs are clean by
  `c64-ram-capture/SKILL.md`'s own machine-identity rule, and the void protocol
  did not apply to either.


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

### Live-half self-check (2026-09-15, Tasks 2/3): PASSED

Every line below is a command that was run, with the answer it returned.

- `test "$(stat -c %s .../captures/original-a.bin)" = "65536"` → PASS
- `test "$(stat -c %s .../captures/original-b.bin)" = "65536"` → PASS
- `node compare.mjs digest .../original-a.bin` → `0e3f47d6... 65536 bytes`, exit 0
- `grep -ac '^capture_route:\|^checkpoint_name:\|^mask_version:' docs/phase50-equivalence-transcript.md` → `3` (the plan's floor is 3)
- `grep -c 'Mask calibration' docs/phase50-equivalence-transcript.md` → `1` (the plan's floor is >0)
- `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` → `tests 23, pass 23, fail 0`
- `node compare-cross-binary.mjs cross ... --limit 0` → `VERDICT: PASS`, `total differing addresses (image + register): 0`, exit 0
- `git ls-files` → both `.bin` files and both `.state.json` sidecars are tracked
- ACME re-check: the symbol list's binary is byte-identical to the committed `.prg` (both `89846d48...`)
- Checkpoint hygiene: `vice_checkpoint_list` after deletion returned `totalReported 0` in BOTH runs, recorded in both sidecars
- Broker shutdown, all four checks, run before any suite: `systemctl --user is-active` → `inactive`; `ps -eo pid,cmd | grep -Ei 'vice-broker|x64sc'` → empty; `ss -ltnp | grep ':66[0-9][0-9]'` → empty; `ss -ltnp | grep ':19510'` → empty
- `npm run test:automated` (broker confirmed down first) → exit 0, `tests 3670, pass 3661, fail 0, skipped 9`. The 9 skips were read by NAME, not by count: all nine are opt-in gates that each state their own reason (upstream clone absent, `ANNO_STORE_EXPORT_LIVE_STORE` unset, `VICE_LIVE_STOCK_BIN` unset ×2, `GHIDRA_HOME` unset ×5). None is a masked failure.

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15 (offline half), 2026-09-15 (live half, Tasks 2/3)*
