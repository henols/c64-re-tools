---
phase: 18-persistent-session-and-tool-surface
plan: 05
subsystem: external-analyser-integration
tags: [anno, tool-surface, curated-allow-list, client-side-composition, range-cap, d-36]

# Dependency graph
requires:
  - phase: 18-persistent-session-and-tool-surface (plan 01)
    provides: "D-36 allocated in .planning/PROJECT.md's Key Decisions table, superseding D-32, with the client-side composition verdict and the upstream issue #42 reversal trigger"
  - phase: 18-persistent-session-and-tool-surface (plan 03)
    provides: "runInAnnoSession() -- the shared session composeAddressDetails()'s four reads run inside"
provides:
  - "anno_read_region curated with both views (disasm/hexdump), a documented ANNO_READ_REGION_MAX_BYTES cap, and a named AnnoReadRegionRangeError enforced pre-spawn inside and outside a batch"
  - "anno_get_address_details curated as composeAddressDetails() -- a client-side composition of anno_get_symbols/anno_get_comments/anno_get_blocks/anno_get_cross_references, never calling upstream's own same-named (u16-overflowing) tool"
  - "CURATED_ANNO_TOOLS at 19 entries, every count pin and prose mention (module header, test titles/assertions, vice-proxy.test.ts's three prose sites) moved from 17 to 19 with no drift left behind"
  - "scripts/check-skill-tool-coverage.mjs's non-vacuity control inverted: it now asserts anno_get_address_details IS curated (D-36), guarding the inclusion the way it used to guard the D-32 exclusion"
affects: ["19 (absorbed-procedure phases can now read a routine by range and get a working address-details answer on a full 64K project)"]

# Actuals (#2632)
actuals:
  tokens: 15600
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side composition to make a defective upstream tool unreachable by construction (D18-27/D18-28): composeAddressDetails() takes the session's own call function, never a project path, so all four composing reads share one connection and the composed tool's own name never appears as a call() argument -- pinned by a source-structural test"
    - "One cap, both views: ANNO_READ_REGION_MAX_BYTES governs both the disasm and hexdump views of anno_read_region with a single named constant, read-at-call-time via an env override (mirroring anno-session.ts's currentRestartBudget() convention)"
    - "Dual call-site range/name validation: assertReadRegionArgs()/assertLegalLabelArg() are each called from both assertCuratedTool() (outer dispatch) and assertCuratedBatch() (inner batch walk), so a refusal fires identically whether smuggled inside anno_batch_execute or not"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/vice-proxy.test.ts
    - scripts/check-skill-tool-coverage.mjs

key-decisions:
  - "Live-probed the external analyser 0.9.20's real tools/list schema for anno_read_region ({start_address, end_address, view}, required [start_address, end_address]) and its omitted-view behavior (identical byte-for-byte to view: 'disasm') before writing the curated definition, per the task's own precondition -- transcribed verbatim into the tool description rather than inferred from upstream source."
  - "ANNO_READ_REGION_MAX_BYTES defaults to 4096, overridable via the same-named env var read at call time (currentReadRegionMaxBytes()), mirroring anno-session.ts's DEFAULT_ANNO_RESTART_BUDGET/currentRestartBudget() convention rather than inventing a second override style."
  - "Re-verified live against the real 0.9.20 binary, on a full 64K project, that upstream's own anno_get_address_details still answers {\"type\":\"OutOfRange\"} at address 0 -- D18-30's reversal trigger (an upstream fix to issue #42) has NOT fired; the composition remains necessary, not merely carried forward unexamined."
  - "anno_batch_execute's inner calls are executed server-side by the external analyser's OWN batch implementation (handler.rs), not re-dispatched through runAnnoTool() per entry -- so allowing anno_get_address_details as a curated inner batch name (as the plan's own acceptance criteria required) means a batch-embedded call to it still reaches upstream's native (defective) implementation rather than the client-side composition. This is the plan's own explicit, narrowly-scoped instruction (\"no longer refused for that reason\"), not a bug this plan introduced -- the must_haves' own structural prohibition is scoped to a literal call() argument in anno-tools.ts, which this reflects exactly. Flagged here for Phase 19 or a future SURF follow-up rather than silently left undiscoverable."
  - "Replaced three test sites that used anno_get_address_details as their example UNCURATED name (now that it is curated) with anno_unpack_binary, a name that remains genuinely uncurated -- preserves each test's original intent without weakening it."

requirements-completed: [SURF-01, SURF-02]

coverage:
  - id: D1
    description: "anno_read_region is curated with both views selectable through one enum parameter, live schema {start_address, end_address, view}, required [project, start_address, end_address]"
    requirement: SURF-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#anno_read_region is curated with the live schema {start_address, end_address, view}, required [project, start_address, end_address]"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#gated: anno_read_region against a real analyser child -- both views resolve, 'view' omitted matches 'disasm' verbatim, a single address returns non-empty, and a cap-sized request returns a result"
        status: pass
    human_judgment: false
  - id: D2
    description: "An inclusive request equal to ANNO_READ_REGION_MAX_BYTES returns a region; one byte more is refused with a named error embedding the requested size and the valid range"
    requirement: SURF-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#assertCuratedTool refuses an anno_read_region request one byte over ANNO_READ_REGION_MAX_BYTES, naming the requested size and the valid range, before any spawn"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#assertCuratedTool accepts an anno_read_region request whose inclusive size equals ANNO_READ_REGION_MAX_BYTES exactly"
        status: pass
    human_judgment: false
  - id: D3
    description: "start_address === end_address returns exactly one address's worth of output (inclusive range), not an empty result and not an error"
    requirement: SURF-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#assertCuratedTool accepts start_address === end_address (a single address is a valid, inclusive, one-byte range)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#gated: anno_read_region against a real analyser child (single-address assertion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "'view' omitted resolves successfully; the live-observed behaviour (identical to view: 'disasm') is recorded verbatim in the curated tool's own description"
    requirement: SURF-01
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#gated: anno_read_region against a real analyser child (omitted-view === disasm assertion)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The 17 pre-existing ANNO_TOOL_DEFINITIONS entries keep their exact order; the two new entries are appended, so CURATED_ANNO_TOOLS's first 17 members are unchanged element-for-element"
    requirement: SURF-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#CURATED_ANNO_TOOLS's first 17 members are unchanged, in the same order, after SURF-01/SURF-02 additions (plan 18-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "anno_get_address_details is curated and its answer is composed entirely client-side from anno_get_symbols, anno_get_comments, anno_get_blocks and anno_get_cross_references, inside ONE session"
    requirement: SURF-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#composeAddressDetails issues exactly 4 tools/call frames (the four named reads), zero naming anno_get_address_details or anno_save_project, all inside ONE session"
        status: pass
    human_judgment: false
  - id: D7
    description: "No curated anno_* code path passes a 64K project's length through upstream's handler.rs:1894 u16 cast: the string anno_get_address_details never appears as a tool-name argument to a call() in anno-tools.ts"
    requirement: SURF-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#SURF-02 (D18-27/D18-28): anno_get_address_details never appears as a literal tool-name argument to call( in anno-tools.ts (source-structural)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The D-32 refusal is gone from both assertCuratedTool() and assertCuratedBatch(); the batch gate now accepts anno_get_address_details as a curated inner name"
    requirement: SURF-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#assertCuratedTool no longer refuses anno_get_address_details (D-36 supersedes D-32's exclusion; it is now curated)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#anno_batch_execute with anno_get_address_details as an inner name is no longer refused for that reason (it is now curated); an uncurated inner name is still refused whole"
        status: pass
    human_judgment: false
  - id: D9
    description: "scripts/check-skill-tool-coverage.mjs's non-vacuity control is inverted, not deleted: it now asserts anno_get_address_details IS curated, citing D-36"
    requirement: SURF-02
    verification:
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs (exit 0); src/mcp/vice/anno-verb-coverage.test.ts#the CI script's live execution path"
        status: pass
    human_judgment: false
  - id: D10
    description: "No stale curated-tool count survives anywhere in src/mcp/vice: the count pin, its test title, its assertion message, anno-tools.ts's module header and the three prose sites in vice-proxy.test.ts all read 19"
    verification:
      - kind: other
        ref: "grep -rc '17 curated' src/mcp/vice/ scripts/ | grep -v ':0$' -- empty output"
        status: pass
    human_judgment: false
  - id: D11
    description: "docs/tool-support.md regenerates byte-identical (the anno_* family is structurally excluded from that table by the generator)"
    verification:
      - kind: integration
        ref: "node scripts/generate-tool-support-table.mjs then git diff --stat docs/tool-support.md -- empty; src/mcp/vice/tool-support-table.test.mjs (7/7 pass)"
        status: pass
    human_judgment: false
  - id: D12
    description: "A real full-64K the external analyser project's composed answer is usable (never upstream's OutOfRange refusal), and the composition issues no save"
    requirement: SURF-02
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#gated: composeAddressDetails against a real full-64K the external analyser project returns a usable answer, and issues no save"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 05: Curated anno_read_region and Client-Side anno_get_address_details Summary

**`anno_read_region` joins the curated surface with both views and a documented 4096-byte cap (`ANNO_READ_REGION_MAX_BYTES`), and `anno_get_address_details` is now curated as a four-read client-side composition (`composeAddressDetails()`) under D-36 — never calling upstream's own same-named tool, which live-reconfirmed still answers `OutOfRange` at every address on a full 64K project.**

## Performance

- **Duration:** ~75 min (3 tasks, sequential on main, no worktree)
- **Started:** 2026-08-24T~10:55Z (first commit `613fbcf`)
- **Completed:** 2026-08-24T~12:10Z (last commit `ed142ba`)
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `anno_read_region` curated: live-probed the real analyser 0.9.20 `tools/list` schema (`{start_address, end_address, view}`, required `[start_address, end_address]`) and its omitted-`view` behavior (byte-for-byte identical to `view: "disasm"`) before writing the definition; both are transcribed verbatim into the tool's own description. `ANNO_READ_REGION_MAX_BYTES` (default 4096, `ANNO_READ_REGION_MAX_BYTES` env override read at call time) governs both views with one cap; `AnnoReadRegionRangeError` names the offending size/range/inversion/out-of-bounds address, enforced pre-spawn via `assertReadRegionArgs()` called from both `assertCuratedTool()` and `assertCuratedBatch()`.
- `anno_get_address_details` curated: `composeAddressDetails(call, address)` runs four already-curated reads (`anno_get_symbols`, `anno_get_comments`, `anno_get_blocks`, `anno_get_cross_references`) sequentially inside the caller's own session, narrows each to the requested address client-side, and returns one object with `composed_client_side: true` and a `composed_from` list. Wired into `runAnnoTool()` as a special case before the generic `READ_ONLY_ANNO_TOOLS` branch — one code path, no small-vs-64K divergence. The tool description states its composed nature and cites upstream issue #42 in the text an LLM caller reads.
- D-32's hardcoded refusal is retired from both `assertCuratedTool()` and `assertCuratedBatch()`; `scripts/check-skill-tool-coverage.mjs`'s non-vacuity control is inverted (not deleted) to assert the tool IS curated under D-36.
- Every curated-tool count moved from 17 to 19: `anno-tools.ts`'s module header (WHY/exclusions/WHAT-IS-THE-ONE-AUTHORITATIVE-PLACE-FOR paragraphs, now also correctly describing the shared `anno-session.ts` session per Rule A21 instead of one session per call), `anno-tools.test.ts`'s count pin/title/message, and `vice-proxy.test.ts`'s three prose sites (their assertions were already dynamically derived and never failed). `docs/tool-support.md` regenerated and confirmed byte-identical.
- Live-reconfirmed against the real installed 0.9.20 binary, on a synthesized full-64K project, that upstream's own `anno_get_address_details` still answers `{"type":"OutOfRange"}` at address 0 — the composed path returns a usable answer instead. This is a fresh observation this session, not inherited from prior research: D18-30's reversal trigger has **not** fired.

## Task Commits

Each task was committed atomically:

1. **Task 1: Curate anno_read_region with both views and a documented range cap** — `613fbcf` (feat)
2. **Task 2: Execute D-36 — compose anno_get_address_details client-side and retire the D-32 refusal** — `fd0c777` (feat)
3. **Task 3: Move every count pin and prose mention to 19, with no drift left behind** — `ed142ba` (docs)

_No TDD tasks in this plan (frontmatter `tdd="true"` on tasks 1/2, but each task's own `<verify>`/acceptance criteria were run and confirmed green before that task's single commit — the plan did not ask for separate RED/GREEN/REFACTOR commits per task, and none of tasks 1/2's commits are `test(...)`-only, so the plan-level TDD gate sequence (RED commit before GREEN commit) does not apply here; see "TDD Gate Compliance" below.)_

## Files Created/Modified

- `src/mcp/vice/anno-tools.ts` — `ANNO_READ_REGION_MAX_BYTES`, `AnnoReadRegionRangeError`, `assertReadRegionArgs()`, the `anno_read_region`/`anno_get_address_details` tool definitions, `composeAddressDetails()`, `runAnnoTool()`'s new special case, `READ_ONLY_ANNO_TOOLS` (now exported, 7 members), module header rewritten for 19 curated tools
- `src/mcp/vice/anno-tools.test.ts` — unit + gated-live tests for both new tools, the ordering/count pins moved to 19, three uncurated-example sites repointed at `anno_unpack_binary`, the gated integration test's stale "fresh session" reasoning corrected with a direct on-disk read
- `src/mcp/vice/vice-proxy.test.ts` — three prose sites (17 → 19); assertions unchanged (already dynamically derived)
- `scripts/check-skill-tool-coverage.mjs` — control 3 inverted (D-36, not D-32)
- `docs/tool-support.md` — regenerated, confirmed byte-identical (not committed; no diff)

## Decisions Made

See `key-decisions` in frontmatter. Most consequential: `anno_batch_execute`'s inner calls run entirely server-side inside the external analyser's own batch implementation (this repo's own module header already documents this: `handler.rs:506-542`'s per-call loop), so allowing `anno_get_address_details` as a curated inner batch name — exactly what this plan's own acceptance criteria required ("no longer refused for that reason") — means a batch-embedded call to it still reaches upstream's native, defective implementation rather than `composeAddressDetails()`. This is not a bug introduced by this plan: it is the plan's own explicit, narrowly-worded instruction, and the must_haves' structural prohibition ("the string `anno_get_address_details` never appears as a tool-name argument to a `call()` in anno-tools.ts") is scoped to exactly the literal check this plan implements and proves. Recorded here as a residual gap for a future SURF follow-up or Phase 19's absorption diff to close (e.g. pre-expanding a batch's `anno_get_address_details` entries into the four composing calls before forwarding), not silently left undiscoverable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assertReadRegionArgs` doc-comment mention inflated its own call-site count**
- **Found during:** Task 1, first test run
- **Issue:** The `AnnoReadRegionRangeError` doc comment referenced `` `assertReadRegionArgs()` `` (with trailing parens), which the source-structural test's `assertReadRegionArgs\(` regex also matched, making the "1 definition + 2 call sites" count read 4 instead of 3.
- **Fix:** Reworded the doc comment to "the `assertReadRegionArgs` validator" (no trailing parens).
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `node --test anno-tools.test.ts` — the count test passes at 3.
- **Committed in:** `613fbcf` (Task 1 commit)

**2. [Rule 1 - Bug] Same class of doc-comment inflation recurred in `assertCuratedTool()`'s own docstring**
- **Found during:** Task 2, full test run after wiring `assertReadRegionArgs` mentions into the allow-list gate's docstring
- **Issue:** `` `assertReadRegionArgs()` `` (with parens) inside `assertCuratedTool()`'s docstring inflated the same count to 4 again.
- **Fix:** Reworded to "validates the range against the documented cap (D18-25)" — no trailing parens.
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `node --test anno-tools.test.ts` — count test passes at 3.
- **Committed in:** `ed142ba` (Task 3 commit, discovered during Task 3's own full-file re-verification after the header rewrite)

**3. [Rule 3 - Blocking] Stub-driven `composeAddressDetails` test failed on `ensureProjectSettings`'s pre-spawn file read**
- **Found during:** Task 2, first run of the frame-counting stub test
- **Issue:** `runInAnnoSession()` calls `ensureProjectSettings(projectPath)` (D18-32) before ever spawning the stub, which requires a real, parseable `.regen2000proj` file on disk. The stub test had not written one, since the stub server itself never needs to load anything.
- **Fix:** Wrote a trivial `synthesizeProject(new Uint8Array(4), { origin: 49152 })` project file to the stub's project path before calling `runAnnoTool`.
- **Files modified:** `src/mcp/vice/anno-tools.test.ts`
- **Verification:** `node --test anno-tools.test.ts` — the stub test passes; `STUB_CALL_LOG` shows exactly 4 frames, none for `ensureProjectSettings` (it never issues a `tools/call`, only local file I/O).
- **Committed in:** `fd0c777` (Task 2 commit)

**4. [Rule 3 - Blocking] Three existing tests used `anno_get_address_details` as their "genuinely uncurated" example**
- **Found during:** Task 2, planning the D-32→D-36 test rewrite
- **Issue:** `assertCuratedTool refuses a batch containing one uncurated inner name`, `assertCuratedTool recurses into a nested anno_batch_execute`, and `runAnnoTool refuses a smuggled batch WHOLE, before any child process is spawned` all injected `anno_get_address_details` as their example of a name that must be refused — now curated, so these tests' own premise broke.
- **Fix:** Repointed all three at `anno_unpack_binary`, which remains genuinely uncurated and preserves each test's original intent (batch-inner refusal, nested-batch recursion, pre-spawn refusal) unchanged.
- **Files modified:** `src/mcp/vice/anno-tools.test.ts`
- **Verification:** `node --test anno-tools.test.ts` — all three tests pass with the new name.
- **Committed in:** `fd0c777` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 self-inflicted doc-comment count bugs, 2 Rule 3 blocking test-premise fixes).
**Impact on plan:** All four were necessary for this plan's own stated verification (`node --test anno-tools.test.ts` exits 0 with the count assertions passing) to hold. No scope creep — none touched files outside this plan's declared `files_modified`.

## TDD Gate Compliance

Tasks 1 and 2 carry `tdd="true"` in their frontmatter, but neither was executed as a strict RED→GREEN→REFACTOR cycle: `<behavior>`/`<action>`/`<verify>` were implemented together and each task's own acceptance-criteria loop (write, run, fix, re-run until green) was used before the single commit — matching this plan's own task shape (source + tests landing together, one commit per task) rather than a separate failing-test commit followed by an implementation commit. No `test(18-05):`-prefixed commit exists in this plan's history; both `613fbcf` and `fd0c777` are `feat(18-05):` commits carrying both source and test changes. This is recorded here per the executor's TDD Gate Compliance rule rather than silently assumed compliant.

## Issues Encountered

- **`bash scripts/package.sh` could not be confirmed clean** as an overall-phase verification step: the packaging/layout validator refuses on a pre-existing, harness-installed `.claude/skills/` directory at the repository root (a `mastra -> ../../.agents/skills/mastra` symlink), present in the working tree since partway through this session and unrelated to any of this plan's three commits — confirmed by `git log --oneline -- .claude/skills` showing it was never tracked, and by the fact that none of this plan's `files_modified` touch `.claude/`. This is environment/harness state from the GSD tooling that ran this executor session, not a regression this plan introduced or a defect in the packaged file set (no new files were created by this plan; `package.json`'s `files[]` is unchanged). Recorded honestly rather than silently reported as passing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SURF-01 and SURF-02 are both closed: the curated `anno_*` surface now sits at 19 tools with no drift between the count pin, the module header, and the three `vice-proxy.test.ts` prose sites.
- `anno_read_region` gives Phase 19's absorbed procedures a direct "read this routine at a range" primitive in either view, with a documented, enforced cap.
- `anno_get_address_details` is safe to call on projects of any size, including a full 64K capture — the exact shape `c64-ram-capture` produces — without hitting upstream's `OutOfRange` defect.
- **Flagged for a future plan (see Decisions Made above):** `anno_get_address_details` embedded as an inner name of `anno_batch_execute` still reaches upstream's native (defective) implementation, since batch execution happens server-side inside the external analyser itself. Not fixed here — the plan's own acceptance criteria explicitly scoped this task to retiring the outer-name refusal, not to pre-expanding batch-embedded calls.
- `bash scripts/package.sh`'s validation failure (see Issues Encountered) is environment noise from this session, not a code defect; a fresh checkout without the harness-installed `.claude/skills/` directory would pass.

---
*Phase: 18-persistent-session-and-tool-surface*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-tools.ts ]` → FOUND (contains `ANNO_READ_REGION_MAX_BYTES`, `composeAddressDetails`, `anno_get_address_details`)
- `[ -f src/mcp/vice/anno-tools.test.ts ]` → FOUND (44 tests, all passing)
- `[ -f src/mcp/vice/vice-proxy.test.ts ]` → FOUND (three prose sites read 19)
- `[ -f scripts/check-skill-tool-coverage.mjs ]` → FOUND (control 3 inverted)
- `git log --oneline --all | grep -q 613fbcf` → FOUND
- `git log --oneline --all | grep -q fd0c777` → FOUND
- `git log --oneline --all | grep -q ed142ba` → FOUND
- `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` → exit 0
- `cd src/mcp/vice && npm test` (full suite, plain, no flags) → **2449 tests, 2405 pass, 0 fail, 39 skipped, 5 todo, exit 0, ~101-105s**
- `node scripts/check-skill-tool-coverage.mjs` → exit 0
- `git diff --stat docs/tool-support.md` (after regenerating) → empty
- `grep -rc '17 curated' src/mcp/vice/ scripts/ | grep -v ':0$'` → no output
- `ps aux | grep -i the external analyser` → no leftover processes
