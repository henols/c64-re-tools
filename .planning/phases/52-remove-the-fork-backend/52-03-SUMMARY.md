---
phase: 52-remove-the-fork-backend
plan: 03
subsystem: vice-mcp
tags: [refactor, module-split, error-hierarchy, lease-state, dead-code-removal]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 01)
    provides: "FORK-01 reversal and docs/stock-hard-losses.md this phase's deletions build on"
  - phase: 52-remove-the-fork-backend (plan 02)
    provides: "FORKRM-01..07 requirement ids this plan's frontmatter cites"
provides:
  - "src/mcp/vice/vice-errors.ts: the ONE definition site for ViceError/MachineRestartedError, readEpoch/EpochResult/EPOCH_FILE, mcpHost(), and the activeInstance()/useInstance() lease-state accessors -- backend-agnostic, load-bearing for stock's own lease path"
  - "Every one of the 41 surviving vice.ts importers (23 non-test + 18 test) repointed to resolve shared symbols from vice-errors.ts; only vice-proxy.ts, refresh-manifest.ts and vice-sync.ts still name vice.ts, and only for its remaining fork-transport symbols"
  - "vice-sync.ts and vice-sync.test.ts deleted (pre-existing dead-shipped-module defect, zero non-test consumers) along with their package.json files[] entry"
  - "vice.ts reduced to the fork HTTP/JSON-RPC transport half only, still importing what it needs from vice-errors.ts -- ready for plan 52-05's whole-file deletion"
affects: [52-04, 52-05, 52-06, 52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 23500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Module split via accessor indirection: when a private module variable a surviving function reads (rpc()'s POST target, an error message's URL/port) moves to a new module, the surviving function is repointed to the new module's PUBLIC accessor (activeInstance()) rather than staying pointed at a variable that no longer exists in its own scope."
    - "Cross-module side-effect removal: a function that used to reach across into a sibling concern's private flag (useInstance() flipping vice.ts's own `initialized`) is redesigned so the OWNING file detects the state change itself (ensureInitialized() comparing its last-handshook URL against the live activeInstance().url) instead of the moved function keeping a back-reference."

key-files:
  created:
    - src/mcp/vice/vice-errors.ts
  modified:
    - src/mcp/vice/vice.ts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/refresh-manifest.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/stock-symbols.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/repo-root.test.ts
    - "(33 further files: 20 non-test + 13 test full import-specifier repoints -- see Task 2 commit)"

key-decisions:
  - "The measured importer counts (23 non-test, 18 test) exactly matched the plan's own re-derived figure -- no drift since the RESEARCH.md census."
  - "activeInstance()'s port/URL fallback was SIMPLIFIED, not preserved: traced every stock caller (buildHeldLease() via ensureBrokerLease(), handleRecycle(), handleGrantedInstanceUnreachable()) and confirmed each runs strictly after a useInstance() write; the VICE_MCP_URL override branch returns before ever calling activeInstance() at all. The DEFAULT_ENDPOINT-derived HTTP-URL parsing was dropped for a plain LEGACY_DEFAULT_PORT=6510 numeric literal."
  - "vice-sync.ts's deletion closes a pre-existing dead-shipped-module defect this phase surfaced, not a ROADMAP item: zero non-test consumers, yet shipped in the tarball."
  - "The plan's read_first prose said vice.test.ts, fork-live.test.ts and refresh-manifest.test.ts 'keep pointing at vice.ts' -- but Task 2's own machine-checked acceptance criterion ('No file imports [moved symbols] from ./vice.ts') is unambiguous and contradicts that grouping for these exact three files (each imports at least one moved symbol). Resolved in favor of the checkable acceptance criteria: vice.test.ts and fork-live.test.ts were split exactly like vice-proxy.ts/refresh-manifest.ts (they import BOTH halves), and refresh-manifest.test.ts was fully repointed (it imports ONLY moved symbols). A fourth dual-import test file the plan's read_first list never named, stock-dispatch.test.ts, was also split for the same reason."
  - "The CLAUDE.md Testing bullet naming vice-sync.ts's 'deliberately not unit-tested' invariant is now stale (the file is gone) but was NOT edited here, per this plan's explicit instruction that plan 52-09 owns both byte-identical copies (CLAUDE.md and .planning/PROJECT.md) together, gated by docs-constraints-sync.test.ts. Flagged as a handoff below."

requirements-completed: []

coverage:
  - id: D1
    description: "vice-errors.ts created, owns all thirteen shared symbols plus their private module state, back-imports nothing from vice.ts, listed in files[]"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
      - kind: other
        ref: "grep -ac 'from \"./vice.ts\"' vice-errors.ts -> 0"
        status: pass
      - kind: other
        ref: "node -e checks package.json files[].includes('vice-errors.ts') -> true"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every surviving importer (23 non-test, 18 test) resolves moved symbols from vice-errors.ts; only vice-proxy.ts/refresh-manifest.ts/vice-sync.ts still name vice.ts, for fork-transport symbols only"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -rl 'from \"./vice.ts\"' (non-test) -> exactly {vice-proxy.ts, refresh-manifest.ts, vice-sync.ts}"
        status: pass
      - kind: other
        ref: "grep -rln '<moved symbol names>' | xargs grep -l 'from \"./vice.ts\"' -> per-file manual verification, zero moved-symbol imports from vice.ts anywhere"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run test:automated -- failure SET unchanged from pre-plan floor plus the documented, out-of-scope docs-linerefs drift"
        status: pass
    human_judgment: false
  - id: D3
    description: "vice-sync.ts and vice-sync.test.ts deleted; files[] entry removed; check-npm-packages.mjs and automatedTestFiles() both agree"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "test ! -f vice-sync.ts && test ! -f vice-sync.test.ts"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs -> exit 0, 104 files"
        status: pass
      - kind: other
        ref: "automatedTestFiles(cwd).includes('vice-sync.test.ts') -> false"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stock lease acquisition remains provably intact end-to-end: buildHeldLease() resolves activeInstance()/useInstance() from vice-errors.ts, and the closed hostpath.ts consumer set (broken by vice-sync.ts's deletion) is repaired in the same commit"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "hostpath-consumers.test.ts (22/22 pass)"
        status: pass
      - kind: unit
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 03: Split vice-errors.ts, Repoint Every Importer, Delete Dead vice-sync.ts Summary

**`vice.ts`'s shared lease/error state (13 symbols, the ones `buildHeldLease()` reads on every stock tool call) is now `vice-errors.ts`, all 41 surviving importers resolve from it, and the zero-consumer `vice-sync.ts` is gone -- typecheck clean, automated-suite failure set unchanged apart from documented, out-of-scope line-citation drift owned by plan 52-04.**

## Performance

- **Duration:** ~75 min (estimated; no precise wall-clock start was captured)
- **Completed:** 2026-09-12
- **Tasks:** 3
- **Files modified:** 47 (1 created, 44 modified, 2 deleted)

## Accomplishments

- Created `src/mcp/vice/vice-errors.ts`: the one definition site for `ViceError`, `ViceErrorOptions`, `MachineRestartedError`, `MachineRestartedErrorOptions`, `readEpoch`, `EpochResult`, `EPOCH_FILE`, `mcpHost`, `activeInstance`, `useInstance`, `ActiveInstance`, `UseInstanceOptions`, `ToolInfo` -- thirteen symbols, verified load-bearing for the STOCK backend's own lease path (`buildHeldLease()` in `vice-proxy.ts`, reached by `ensureBrokerLease()` on every tool call, on both backends), not fork-only as the ROADMAP Notes implied.
- `vice.ts` reduced to the fork HTTP/JSON-RPC transport half only (`DEFAULT_ENDPOINT`, `rpc`, `ensureInitialized`, `withReconnect`, `call`/`callTool`, `serverInfo`, `DENY_LIST`, `denyListRefusalMessage`, the session-identity apparatus), now importing `activeInstance`, `mcpHost`, `readEpoch`, `ViceError`, `MachineRestartedError` from `vice-errors.ts`.
- Repointed all 23 non-test and 18 test importers measured by a fresh grep (matching the plan's own re-derived count exactly): 33 files needed only an import-specifier change; 5 files (`vice-proxy.ts`, `refresh-manifest.ts`, `vice.test.ts`, `fork-live.test.ts`, `stock-dispatch.test.ts`) import symbols from BOTH halves and were split into two import statements each.
- Deleted `vice-sync.ts` (336 lines, zero non-test consumers, shipped in the tarball with no caller) and `vice-sync.test.ts`, and removed the `"vice-sync.ts"` `files[]` entry -- a pre-existing dead-shipped-module defect this phase surfaced, not a ROADMAP item.
- Confirmed and repaired a real second-order regression the deletion caused: `vice-sync.ts` was the fifth member of `hostpath-consumers.test.ts`'s CLOSED five-member production consumer set (it imported `hostpath.ts`'s `tryHostPaths`). Deleting it without updating the guard would have left that test permanently red. Fixed the pinned `EXPECTED_IMPORTERS` array, its length assertion, and every "five production modules" comment across `hostpath-consumers.test.ts`, `vice-proxy.ts`, `vice-broker-client.ts`, and `stock-symbols.ts` to the new, correct four.
- `npm run typecheck` exits 0; `node scripts/check-npm-packages.mjs` exits 0 (104 files, transitive closure from `vice-proxy.ts` clean); `automatedTestFiles()` no longer includes `vice-sync.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vice-errors.ts and move the thirteen shared symbols into it** - `de529773` (feat)
2. **Task 2: Repoint every surviving importer from ./vice.ts to ./vice-errors.ts** - `27ebaa2e` (feat)
3. **Task 3: Delete vice-sync.ts, its test, and its files[] entry** - `b11be608` (fix)

_Note: Task 1's own `<verify>` typecheck could not pass in isolation -- see Deviations, "Sequencing" below. Both tasks' edits were implemented together before the first typecheck run, then split into two commits matching the plan's task boundaries._

## Files Created/Modified

- `src/mcp/vice/vice-errors.ts` - new shared module (error hierarchy + lease-state accessors)
- `src/mcp/vice/vice.ts` - reduced to the fork transport half; `rpc()`/`withReconnect()` now read the active URL/port through `activeInstance()`; `ensureInitialized()` redesigned to detect a redirected lease itself; `beginSession()`'s default epoch path now reads `activeInstance().epochFile`
- `src/mcp/vice/vice-proxy.ts` - import block split into two statements (moved symbols from `vice-errors.ts`, fork symbols from `vice.ts`); three stale "five production modules" comments corrected to four
- `src/mcp/vice/package.json` - `vice-errors.ts` added to `files[]`; `vice-sync.ts` removed
- `src/mcp/vice/refresh-manifest.ts` - import split (`activeInstance`/`ToolInfo` vs `serverInfo`/`ServerInfoPayload`)
- `src/mcp/vice/hostpath-consumers.test.ts` - `EXPECTED_IMPORTERS` and every "five-member" reference corrected to four
- `src/mcp/vice/vice-broker-client.ts`, `src/mcp/vice/stock-symbols.ts` - stale "vice-sync.ts" consumer-set comments corrected
- `src/mcp/vice/module-classification.ts` - drifted `runAnnoCli` line citation repaired (307 -> 304)
- `src/mcp/vice/anno-types.test.ts`, `src/mcp/vice/repo-root.test.ts` - pinned import-specifier/subprocess-import content fixed for the repoint
- 20 further non-test modules and 13 further test files: mechanical import-specifier repoint only (`anno-store.ts`, `anno-types.ts`, `evid-ingest.ts`, `stock-address.ts`, `stock-condition.ts`, `stock-connect.ts`, `stock-derived.ts`, `stock-diagnose.ts`, `stock-dispatch.ts`, `stock-handler.ts`, `stock-paths.ts`, `stock-petscii.ts`, `stock-protocol.ts`, `stock-recycle.ts`, `stock-reproducible-run.ts`, `stock-symbols.ts`, `stock-timing.ts`, `text-connect.ts`, `text-protocol.ts`, `vice-broker-client.ts`; `anno-confinement.test.ts`, `anno-durability.test.ts`, `anno-overlap.test.ts`, `anno-store.test.ts`, `broker-epoch.test.ts`, `refresh-manifest.test.ts`, `stock-connect.test.ts`, `stock-diagnose.test.ts`, `stock-handler.test.ts`, `stock-reproducible-run.test.ts`, `stock-run-until.test.ts`, `stock-timing.test.ts`, `vice-broker-client.test.ts`)
- Split (both halves): `vice.test.ts`, `fork-live.test.ts`, `stock-dispatch.test.ts`
- Deleted: `src/mcp/vice/vice-sync.ts`, `src/mcp/vice/vice-sync.test.ts`

## Decisions Made

See `key-decisions` in frontmatter for the full record. In short: the importer census matched the plan exactly (23/18); `activeInstance()`'s port/URL fallback was simplified rather than preserved, since every stock caller provably runs after a `useInstance()` write; `vice-sync.ts`'s deletion is a pre-existing defect this phase surfaced; and the plan's read_first prose about which test files "keep pointing at vice.ts" was superseded by its own more specific, machine-checked acceptance criteria for four files (`vice.test.ts`, `fork-live.test.ts`, `refresh-manifest.test.ts`, `stock-dispatch.test.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vice.ts`'s surviving fork-transport code directly referenced the private module state that moved to `vice-errors.ts`**
- **Found during:** Task 1, immediately after drafting the split (before the first typecheck run)
- **Issue:** `rpc()`'s `fetch(activeUrl, ...)`, `withReconnect()`'s exhausted-retry message (`${activeUrl}`/`${activePort}`), and `beginSession()`'s default parameter (`epochPath = activeEpochFile`) all read the private `activeUrl`/`activePort`/`activeEpochFile` variables directly -- these are exactly the state `useInstance()`/`activeInstance()` own, and they moved to `vice-errors.ts`. Left as-is, this would not compile.
- **Fix:** Repointed each site through the exported `activeInstance()` accessor (`activeInstance().url`, `activeInstance().port`, `activeInstance().epochFile`) instead of the now-relocated private variables.
- **Files modified:** `src/mcp/vice/vice.ts`
- **Verification:** `npm run typecheck` exits 0; `vice.test.ts`'s three structural regex tests over `rpc()`/`withReconnect()`/`assertSameMachine()`'s message text still pass (the regexes match substrings unrelated to the variable-access rewrite).
- **Committed in:** `de529773` (Task 1 commit)

**2. [Rule 3 - Blocking] `useInstance()` could no longer reset the fork transport's own MCP handshake flag**
- **Found during:** Task 1, same pass
- **Issue:** The original `useInstance()` set `initialized = false` on redirect, so the fork's next `ensureInitialized()` call would re-handshake against the new endpoint. `initialized` is fork-transport-only state that stays in `vice.ts`; `useInstance()` moving to the backend-agnostic `vice-errors.ts` can no longer reach across the module boundary to flip it (and per the plan's own design intent, should not -- `vice-errors.ts`'s header explicitly forbids importing from `vice.ts`).
- **Fix:** Redesigned `ensureInitialized()` in `vice.ts` to track `initializedUrl` (the URL it last handshook against) and compare it to the CURRENT `activeInstance().url` on every call, re-handshaking on a mismatch -- achieving the same observable behavior (a lease redirect forces a fresh handshake) without `useInstance()` needing to know the fork transport exists. `useInstance()`'s console.error warning ("called while a session was already open") was dropped as part of this: it depended on the now-inaccessible `initialized` flag, and on the STOCK path (where `initialized` is never true) it never fired anyway, so this is a diagnostic-only behavior change with zero effect on either backend's correctness.
- **Files modified:** `src/mcp/vice/vice.ts`, `src/mcp/vice/vice-errors.ts`
- **Verification:** `npm run typecheck` exits 0; no test asserted the dropped warning text (confirmed by grep before removing it); `vice.test.ts`'s `serverInfo()`/`useInstance()` round-trip test still passes.
- **Committed in:** `de529773` (Task 1 commit)

**3. [Rule 2/Comment-discipline] Two new shipped-source comments violated CLAUDE.md's planning-vocabulary rule (PKG-03)**
- **Found during:** Task 2, first full-suite run after the repoint
- **Issue:** Two comments I wrote during the split used an "assignment shape" naming a numbered phase (`vice.ts:206`: "`initializedUrl` is Phase 52's replacement for..."; `vice-errors.ts:137`: "...lives in this module after the Phase 52 split..."), tripping `comment-phase-pointers.test.ts`'s PKG-03 guard, which polices exactly this pattern in shipped `src/mcp/vice/` source.
- **Fix:** Reworded both to describe the change without citing a phase number, matching the ~124 other legitimate historical narration comments already in the tree that the guard's own header says are fine.
- **Files modified:** `src/mcp/vice/vice.ts`, `src/mcp/vice/vice-errors.ts`
- **Verification:** `node --test comment-phase-pointers.test.ts` -- 16/16 pass.
- **Committed in:** `de529773` (Task 1 commit)

**4. [Rule 1 - Bug] `anno-types.test.ts`'s pinned import-specifier list, `repo-root.test.ts`'s subprocess import, and a drifted `runAnnoCli` line citation in `module-classification.ts`**
- **Found during:** Task 2, first full-suite run after the repoint
- **Issue:** `anno-types.test.ts` hard-codes `anno-types.ts`'s exact expected import specifier set (`["./disasm-opcodes.ts", "./vice.ts", "node:fs", "node:path"]`) -- correctly stale the moment `anno-types.ts`'s own import moved. `repo-root.test.ts` spawns a Node subprocess that literally does `import { EPOCH_FILE } from ".../vice.ts"`, which no longer exports it. `module-classification.ts`'s `runAnnoCli` consumer entry cited `vice-proxy.ts:307`, which drifted (along with two OTHER pinned citation families, see "Reported, Not Fixed" below) because my import-block edit in `vice-proxy.ts` shifted every later line by -4.
- **Fix:** Updated `anno-types.test.ts`'s two `assert.deepEqual` expectations to `./vice-errors.ts`; repointed `repo-root.test.ts`'s `VICE_MODULE_URL` (and two prose comments) to `./vice-errors.ts`; corrected `module-classification.ts`'s citation to the new real line, 304 (in both the structured `basis.consumers` entry and the matching prose comment).
- **Files modified:** `src/mcp/vice/anno-types.test.ts`, `src/mcp/vice/repo-root.test.ts`, `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test anno-types.test.ts` (23/23 pass), `node --test repo-root.test.ts` (9/9 pass), `node --test module-classification.test.ts` (20/20 pass).
- **Committed in:** `27ebaa2e` (Task 2 commit)

**5. [Rule 1 - Bug] Deleting `vice-sync.ts` broke `hostpath-consumers.test.ts`'s closed five-member consumer set**
- **Found during:** Task 3, precondition/read_first investigation before deleting
- **Issue:** `vice-sync.ts` imported `hostpath.ts`'s `tryHostPaths` and was therefore one of the FIVE modules `hostpath-consumers.test.ts`'s `EXPECTED_IMPORTERS` pins as the entire closed host-path consumer set. Deleting the file without updating the guard would leave `hostpath-consumers.test.ts`'s core test permanently red (the set shrinks to four but the guard still expects five, byte-for-byte).
- **Fix:** Updated `EXPECTED_IMPORTERS`, the length assertion, and every prose "five-member"/"five production modules" reference in `hostpath-consumers.test.ts` to four; corrected the same stale "(..., vice-sync.ts)" phrasing in `vice-proxy.ts`, `vice-broker-client.ts`, and `stock-symbols.ts`'s own comments (all three cite this exact closed set by name).
- **Files modified:** `src/mcp/vice/hostpath-consumers.test.ts`, `src/mcp/vice/vice-proxy.ts`, `src/mcp/vice/vice-broker-client.ts`, `src/mcp/vice/stock-symbols.ts`
- **Verification:** `node --test hostpath-consumers.test.ts` -- 22/22 pass; `npm run typecheck` exits 0 (the `vice-proxy.ts` comment edit was verified line-count-neutral so as not to re-drift the `rewriteArguments()`/`forwardToVice()` citations already reported below).
- **Committed in:** `b11be608` (Task 3 commit)

**6. [Clarification, not a fix] Plan's read_first grouping of "test files that keep pointing at vice.ts" conflicted with its own acceptance criteria**
- **Found during:** Task 2, while enumerating the 18 test importers via the plan's own instructed grep
- **Issue:** The plan's Task 2 read_first said `vice.test.ts`, `fork-live.test.ts`, `refresh-manifest.test.ts`, and `capability-registry.test.ts`'s manifest reads "keep pointing at `vice.ts` and are dealt with by later plans." But `vice.test.ts` imports `useInstance, serverInfo, activeInstance, mcpHost` (three moved, one fork-only), `fork-live.test.ts` imports `useInstance, call, serverInfo, beginSession, readEpoch` (two moved, three fork-only), and `refresh-manifest.test.ts` imports `useInstance, activeInstance` (both moved, nothing fork-only). Task 2's own machine-checked acceptance criterion -- "No file imports `ViceError`, `MachineRestartedError`, `readEpoch`, `EPOCH_FILE`, `mcpHost`, `activeInstance`, `useInstance` or `ToolInfo` from `./vice.ts`" -- applies with no test-file exemption and is directly violated by leaving these three untouched. `capability-registry.test.ts` (DENY_LIST only, genuinely fork-only) matches the read_first grouping correctly and was left alone.
- **Resolution:** Followed the specific, checkable acceptance criterion over the general read_first prose: split `vice.test.ts` and `fork-live.test.ts` (each imports both halves) exactly like `vice-proxy.ts`/`refresh-manifest.ts` are split in the same task's own action text; fully repointed `refresh-manifest.test.ts` (imports only moved symbols). A fifth dual-import test file the read_first list never named at all, `stock-dispatch.test.ts` (`DENY_LIST, MachineRestartedError, type ToolInfo`), was found during the file-by-file pass and split the same way.
- **Files affected:** `src/mcp/vice/vice.test.ts`, `src/mcp/vice/fork-live.test.ts`, `src/mcp/vice/refresh-manifest.test.ts`, `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** Every acceptance-criteria grep re-run and confirmed passing (see coverage block); `git diff -U0` on these four files shows only import-line changes, no assertion text touched.
- **Committed in:** `27ebaa2e` (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 blocking compile-fixes, 1 comment-discipline fix, 2 test/citation drift repairs) + 1 clarification (no code change beyond what the acceptance criteria already required).
**Impact on plan:** All fixes were mechanical, necessary consequences of the split and deletion this plan's own tasks specify. No scope creep, no behavior change to either backend beyond the plan's own explicitly-authorized `activeInstance()` fallback simplification.

## Reported, Not Fixed (per plan's explicit instruction -- owned by later plans)

**Line-citation drift in `CLAUDE.md` / `.planning/PROJECT.md` / `docs-linerefs.test.ts` (owned by plan 52-04).** My `vice-proxy.ts` import-block edit (Task 2) shifted every line below it by exactly -4. This drifted the four line numbers `docs-linerefs.test.ts` mechanically checks against `CLAUDE.md`'s and `.planning/PROJECT.md`'s Architecture bullet:

| Citation | Old (per CLAUDE.md) | New (measured 2026-09-12) |
|---|---|---|
| `forwardToVice()` function start | `vice-proxy.ts:3035` | `vice-proxy.ts:3031` |
| `forwardToVice()`'s `rewriteArguments()` call | `vice-proxy.ts:3100` | `vice-proxy.ts:3096` |
| `gatherWedgeEvidence()` function start | `vice-proxy.ts:1505` | `vice-proxy.ts:1501` |
| `gatherWedgeEvidence()`'s `rewriteArguments()` call | `vice-proxy.ts:1529` | `vice-proxy.ts:1525` |

Two more citations to the same neighborhood, useful for 52-04's own work, also shifted by the same -4 (not directly pinned by `docs-linerefs.test.ts`, but part of the same key_link this plan's own frontmatter calls out):

| Citation | Old | New |
|---|---|---|
| `buildHeldLease()` function start | `vice-proxy.ts:2349` | `vice-proxy.ts:2345` |
| `useInstance()` lease-grant call site (inside `adoptGrant()`, via `ensureBrokerLease()`) | `vice-proxy.ts:2552` | `vice-proxy.ts:2548` |

Per this plan's own known-constraints guidance and CLAUDE.md's own instruction ("treat a mismatch as drift to re-verify, never as evidence the constraint itself changed"), I did NOT edit `CLAUDE.md`, `.planning/PROJECT.md`, or `docs-linerefs.test.ts` -- plan 52-04 owns retiring this whole Architecture bullet and guard (per RESEARCH.md §7: `forwardToVice()`/`gatherWedgeEvidence()`/`rewriteArguments()` become unreachable once `buildBackendAwareTool()`'s fork arm is deleted, which is 52-04's own work, so the underlying hazard the bullet names goes away entirely rather than needing new numbers). This surfaces as 4 new members in the automated-suite failure set: `CLAUDE.md: every citation resolves in vice-proxy.ts`, `.planning/PROJECT.md: every citation resolves in vice-proxy.ts`, `every vice-proxy.ts:<N> citation in a scanned document's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function`, and `planted-violation (WR-09): a citation pointing at an unrelated top-level function is REJECTED, and the two real function-start citations are ACCEPTED`.

**The stale `CLAUDE.md` Testing bullet naming `vice-sync.ts` (owned by plan 52-09).** CLAUDE.md's `**Testing**` bullet reads: "`vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested... Preserve the documented invariants (exactly one resume per wait; poll on `hit_count`, never on paused state)." The file this bullet names is now deleted. Per this plan's `<prior_wave_context>` instruction, this text and its byte-identical twin in `.planning/PROJECT.md`'s `## Constraints` (checked by `docs-constraints-sync.test.ts`) are retired together by plan 52-09, not here. No live automated guard currently checks that this specific bullet's named file exists (confirmed: the automated suite's failure set gained no member attributable to this staleness), so this is a pure documentation handoff, not a red test.

## Issues Encountered

None beyond the deviations documented above, all resolved within this plan's own scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vice.ts` still exists, holds only the fork transport half, and is ready for whole-file deletion by plan 52-05.
- Every later deletion plan in this phase can now `npm run typecheck` as proof that a deletion only removed genuinely fork-only code -- the shared lease/error state is safely isolated in `vice-errors.ts` and cannot be accidentally deleted alongside the fork transport.
- Plan 52-04 has the exact new line numbers it needs for the `rewriteArguments()`/`forwardToVice()`/`gatherWedgeEvidence()` Architecture-bullet retirement (table above).
- Plan 52-09 has the exact stale `CLAUDE.md`/`.planning/PROJECT.md` Testing-bullet text it needs to retire (naming `vice-sync.ts`).
- `FORKRM-01` remains `Pending` in `.planning/REQUIREMENTS.md` -- it is declared by six sibling plans in this phase (52-02, 52-03, 52-04, 52-05, 52-06, 52-10) and the shared-ID gate correctly withholds `Complete` until all six have a SUMMARY.
- No blockers.

## Self-Check: PASSED

- `src/mcp/vice/vice-errors.ts` exists: `FOUND` (confirmed with `[ -f ]`).
- `src/mcp/vice/vice-sync.ts` and `src/mcp/vice/vice-sync.test.ts` are absent: confirmed with `test ! -f` (both exit 0).
- All three commit hashes verified present: `git log --oneline --all | grep -E 'de529773|27ebaa2e|b11be608'` returns all three.
- `npm run typecheck` exits 0 (re-confirmed as the final action before writing this SUMMARY).
- `node scripts/check-npm-packages.mjs` exits 0 (104 files).
- Automated suite failure set: 7 documented baseline members + 4 documented, out-of-scope `docs-linerefs` drift members (occasionally +1 pre-existing flake, `check-skill-fork-honesty`, confirmed intermittent across three consecutive runs) -- no new, unexplained member in any of the four full-suite runs performed during this plan.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
