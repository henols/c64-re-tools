---
phase: 05-skill-critical-derived-tools
plan: 02
subsystem: api
tags: [mcp, vice, binary-monitor, symbol-table, derived-tool, stock-backend]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler
    provides: "the derived-tool seam (withDerivedTool()/STOCK_DERIVED_TOOLS) and stock-address.ts's SymbolResolver holder, widened for exactly this consumer"
provides:
  - "handleSymbolsLoad and handleSymbolsLookup (stock-symbols.ts), the two DERIV-04 session-free (needsSession:false) derived-tool handlers"
  - "derivedAnswer() in stock-handler.ts -- the one builder for a session-free derived answer's runState:\"unknown\" stamp"
  - "A VICE label-file parser (al C:xxxx .Name) with workspace-containment path safety and three resource ceilings"
affects: ["05-06 (wires vice_symbols_load/vice_symbols_lookup into STOCK_DISPATCH_TABLE, STOCK_DERIVED_TOOLS, tools-manifest.stock.json, package.json files[])"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "derivedAnswer(payload) -- the session-free counterpart to stockAnswer(), stamping runState:\"unknown\" since no session was ever opened"
    - "Workspace path containment for a read (not a write): resolve against repoRoot(), reject unless resolved === root || resolved.startsWith(root + sep), then re-apply the same check to realpathSync() to catch a symlink escape"
    - "Load-is-replace-never-merge for a client-side resolver table, mirroring the fork's own single-active-symbol-table framing"

key-files:
  created:
    - .claude/mcp/vice/stock-symbols.ts
    - .claude/mcp/vice/stock-symbols.test.ts
  modified:
    - .claude/mcp/vice/stock-handler.ts
    - .claude/mcp/vice/stock-handler.test.ts

key-decisions:
  - "derivedAnswer() added to stock-handler.ts (not a bare literal, not a session workaround) so the standing D-06 runState-enum gate needs no exemption for the two needsSession:false symbol tools (D-05-06)"
  - "format 'kickasm'/'simple' refused by name; 'auto'/'vice' both parse only the confirmed 'al C:xxxx .Name' pattern with no format sniffing (D-05-02)"
  - "A 0-symbol load is a success with an explanatory note, never an error -- it is itself diagnostic"

patterns-established:
  - "Session-free derived tools answer through derivedAnswer(), never stockAnswer() (no session to read runState from) and never a hand-built literal"

requirements-completed: [DERIV-04]

# Metrics
duration: 9min
completed: 2026-08-17
---

# Phase 5 Plan 2: Client-Side Symbol Store (DERIV-04) Summary

**`vice_symbols_load`/`vice_symbols_lookup` as a client-side VICE label-file store, installing into stock-address.ts's existing SymbolResolver holder with zero code changes anywhere else.**

## Performance

- **Duration:** ~9 min (task commits 19:31:05 -> 19:39:48 UTC+2, 2026-08-17)
- **Started:** 2026-08-17T17:31:05Z
- **Completed:** 2026-08-17T17:39:48Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified) + 1 out-of-scope doc (deferred-items.md)

## Accomplishments

- `derivedAnswer()` added to `stock-handler.ts` -- the ONE builder for a session-free derived tool's successful answer, stamping `runState: "unknown"` (the honest value: no session was opened, so the run state was genuinely never observed).
- `stock-symbols.ts` created: `handleSymbolsLoad`/`handleSymbolsLookup`, both `DerivedPureHandler` (`needsSession: false`), parsing a VICE label file client-side and installing a `SymbolResolver` into `stock-address.ts`'s single existing holder via `setSymbolResolver()` -- never a second holder.
- Full test coverage (25 tests in `stock-symbols.test.ts` + 4 new tests in `stock-handler.test.ts`) including the zero-code-change integration proof: `parseAddress()`, `symbolNameFor()`, and `hasSymbolStore()` (all defined in `stock-address.ts`, untouched by this plan) all change behaviour after a `handleSymbolsLoad` call.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add derivedAnswer() to stock-handler.ts** - `bdfd395` (feat)
2. **Task 2: Create stock-symbols.ts -- the label-file parser, workspace containment, and the resolver install** - `3c9d9e3` (feat)
3. **Task 3: Create stock-symbols.test.ts -- including the zero-code-change resolver integration proof** - `17ca75b` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/stock-handler.ts` - adds `derivedAnswer(payload)`, extends the file's "WHAT NOT TO DO" list
- `.claude/mcp/vice/stock-handler.test.ts` - 4 new tests covering `derivedAnswer()`'s payload passthrough, runState overwrite, empty-payload shape, and `StockToolResult` assignability
- `.claude/mcp/vice/stock-symbols.ts` - `handleSymbolsLoad`, `handleSymbolsLookup`, `resetSymbolStoreForTest`, `StockSymbolsError`, the VICE label-file parser and path-containment logic
- `.claude/mcp/vice/stock-symbols.test.ts` - 25 tests: parsing/answer shape, path containment, resource ceilings, format refusals, lookup behaviour, and the zero-code-change integration proof
- `.planning/phases/05-skill-critical-derived-tools/deferred-items.md` - out-of-scope discovery log (see Issues Encountered below)

## Reusable Artifacts for 05-06 (per this plan's `<output>` instruction)

**`derivedAnswer()`'s exact signature** (stock-handler.ts):
```typescript
export function derivedAnswer(payload: Record<string, unknown>): StockOkResult
```
Takes no client argument. Stamps `runState: "unknown"` LAST, overwriting any caller-supplied `runState` key.

**`vice_symbols_load` answer keys** (05-06 writes `outputSchema` from this list -- do NOT list `runState` twice; it is the only key added by `derivedAnswer()` beyond what `handleSymbolsLoad` itself puts in `payload`):
- `path` (string) -- the argument as given, unmodified
- `resolvedPath` (string) -- the contained absolute container path (never host-translated)
- `format` (string) -- always `"vice"` on the success path (`auto` resolves to it)
- `symbolCount` (number)
- `skippedLines` (number)
- `duplicateNames` (number)
- `lineCount` (number)
- `replaced` (boolean) -- whether a table was already installed before this load
- `note` (string, OPTIONAL) -- present only when `symbolCount === 0`
- `runState` (string enum `["running","stopped","unknown"]`, always `"unknown"` in practice for this tool) -- added by `derivedAnswer()`, not by the handler

Required set for `outputSchema` (i.e. keys always present): `path`, `resolvedPath`, `format`, `symbolCount`, `skippedLines`, `duplicateNames`, `lineCount`, `replaced`, `runState`. `note` is the only optional key.

**`vice_symbols_lookup` answer keys:**
- `query` (object) -- carries whichever of `{name}` or `{address}` was supplied, e.g. `{ "name": "main" }` or `{ "address": 53280 }`
- `found` (boolean)
- `name` (string, OPTIONAL) -- present only when `found === true`
- `address` (number, OPTIONAL) -- present only when `found === true`
- `symbolCount` (number) -- the currently loaded total (0 if no table)
- `note` (string, OPTIONAL) -- present only when no table is loaded at all (text: `"no symbol table is loaded -- call vice_symbols_load first"`)
- `runState` (string enum, always `"unknown"`) -- added by `derivedAnswer()`

Required set for `outputSchema`: `query`, `found`, `symbolCount`, `runState`. `name`, `address`, `note` are all optional.

**Exact fixture text used** (05-06's conformance case can reuse this verbatim -- also embedded as the `FIXTURE` constant in `stock-symbols.test.ts`):
```
al C:0810 .main
al C:d020 .vic_cborder
al C:FFD2 .chrout

; this is not a label
break $0810
al C:0900 .main
al C:0810 .entry
```
Parses to: `symbolCount: 4` -- by-name lookups: `main` -> `0x0900` (last-definition-wins), `vic_cborder` -> `0xd020`, `chrout` -> `0xffd2`, `entry` -> `0x0810`; by-address lookup: `0x0810` -> `main` (first-name-wins, so `entry` never surfaces from an address lookup despite being a valid name lookup itself). `duplicateNames: 1` (`main` redefined), `skippedLines: 3` (blank line, comment line, `break` line), `lineCount: 8`.

## Decisions Made

- **D-05-06 (adopted from plan):** `derivedAnswer()` joins `stock-handler.ts` rather than exempting the two symbol tools from the standing D-06 gate or giving them a session they structurally should never need. See `05-02-PLAN.md`'s `plan_decision_D-05-06` block for the full three-option analysis.
- **D-05-02 (adopted from plan):** `format: 'kickasm'`/`'simple'` refused by name; `'auto'` does no format sniffing. See `05-02-PLAN.md`'s `plan_decision_D-05-02` block.
- No new decisions beyond what the plan already specified -- executed as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A header comment inadvertently matched the plan's own `isError: false` absence-grep gate**

- **Found during:** Task 2 (writing `stock-symbols.ts`'s header comment)
- **Issue:** The "WHAT NOT TO DO" bullet quoted the literal text `` `{ content, isError: false }` `` as an example of a forbidden literal shape -- but the plan's own acceptance criterion runs a plain `grep -c 'isError: false'` over the whole file (not comment-stripped) expecting `0`, so the comment itself tripped the gate it was documenting.
- **Fix:** Reworded the bullet to describe the forbidden shape in prose ("a success-result object literal by hand (an 'isError' field set to the negative literal)") without spelling out the exact matched substring.
- **Files modified:** `.claude/mcp/vice/stock-symbols.ts`
- **Verification:** `grep -c 'isError: false' stock-symbols.ts` now outputs `0`; `npm run typecheck` still exits 0.
- **Committed in:** `3c9d9e3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug -- a gate-tripping comment, not a functional defect)
**Impact on plan:** No scope creep; purely a self-inflicted documentation wording fix caught by the plan's own acceptance script before commit.

## Issues Encountered

- **Pre-existing, unrelated `repo-root.test.ts` failure surfaced by `npm run test:automated`.** This execution runs inside a git worktree nested under the main repo's own `.claude/worktrees/agent-ad543494a9010b56c/` directory. `repoRoot()`'s `.git`-ancestor walk correctly finds the worktree's own `.git` file at that nested location, but a pre-existing test asserts "the agreed directory must not sit under `.claude`" -- an assumption written for a normally-rooted checkout, not a worktree nested inside another checkout's `.claude/` tree. Confirmed unrelated to this plan: reproduces identically running `repo-root.test.ts` alone with no other test file loaded, and neither `stock-symbols.ts` nor `stock-symbols.test.ts` import or modify `repo-root.ts`. Logged to `.planning/phases/05-skill-critical-derived-tools/deferred-items.md` per the scope-boundary rule (out-of-scope pre-existing failures are logged, not fixed). All test commands this plan's own verification block names (excluding the full `test:automated` run, which surfaces this one unrelated pre-existing failure) pass cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `stock-symbols.ts` is fully built and tested but **NOT YET WIRED** -- by this plan's explicit design (see `05-02-PLAN.md`'s objective: "This plan does NOT register either tool"). 05-06 (wave 2) is responsible for:
  - Adding `stock-symbols.ts` to `package.json`'s `files[]` in the same commit that adds its import to `stock-dispatch.ts` (Phase 3 Rule 2)
  - Registering both tools in `STOCK_DISPATCH_TABLE` via `withDerivedTool("vice_symbols_load", { needsSession: false }, handleSymbolsLoad)` and the `_lookup` equivalent
  - Adding both tool names to `STOCK_DERIVED_TOOLS` in `stock-derived.ts`
  - Writing both tools' `inputSchema`/`outputSchema` entries in `tools-manifest.stock.json`, using the exact answer-key lists recorded above
- The extension point this plan installs into (`stock-address.ts`'s `SymbolResolver` holder) required and received **zero code changes** -- confirming 04-05's own "Next Phase Readiness" claim held exactly as stated.
- `vice_disassemble`'s existing `show_symbols` path will pick up a loaded symbol table automatically once 05-06 wires `vice_symbols_load` -- no change needed to `stock-disassemble.ts`.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-symbols.ts`
- FOUND: `.claude/mcp/vice/stock-symbols.test.ts`
- FOUND: `.claude/mcp/vice/stock-handler.ts`
- FOUND: `.claude/mcp/vice/stock-handler.test.ts`
- FOUND: `.planning/phases/05-skill-critical-derived-tools/deferred-items.md`
- FOUND commit: `bdfd395`
- FOUND commit: `3c9d9e3`
- FOUND commit: `17ca75b`
