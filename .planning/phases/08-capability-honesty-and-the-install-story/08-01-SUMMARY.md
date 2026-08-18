---
phase: 08-capability-honesty-and-the-install-story
plan: 01
subsystem: mcp-server
tags: [typescript, node-test, capability-registry, backend-detect, deny-list-pattern]

# Dependency graph
requires: []
provides:
  - "capability-registry.ts -- the single source of truth for per-backend capability data (BACK-05)"
  - "CAPABILITY_REGISTRY (26 entries: 6 hardware, 18 descoped, 2 stock-only-gain)"
  - "capabilityEntryFor(name) and capabilityRefusalMessage(name, activeBackend) -- runtime-importable lookup/refusal functions"
  - "capability-registry.test.ts -- mechanical completeness proof against both shipped manifests, automated mirror for plan 08-02's manual suite"
  - "capability-registry.ts shipped in package.json's files[] plus a check-npm-packages.mjs regression guard"
affects: [08-02, 08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One array + one message-rendering function, keyed by hazard/reason shape -- mirrors vice.ts's DENY_LIST / denyListRefusalMessage() exactly, now with a third sibling seam"
    - "Mechanical completeness test derives its expected set from the two shipped manifests at test time, never hand-listed, with a non-vacuity control guarding against a silently-empty derivation"

key-files:
  created:
    - .claude/mcp/vice/capability-registry.ts
    - .claude/mcp/vice/capability-registry.test.ts
  modified:
    - .claude/mcp/vice/package.json
    - scripts/check-npm-packages.mjs

key-decisions:
  - "capabilityRefusalMessage() returns undefined (not a wording) for a genuinely unknown tool name AND for a same-backend miss, so the pre-existing generic 'Unknown tool' message still fires correctly for typos"
  - "vice_diagnose and vice_recycle excluded entirely (synthetic, registered on both backends) rather than added with a special-cased category, matching research's resolved Open Question 2"
  - "vice_sid_set_state's reason text is deliberately distinct from vice_sid_get_state's -- writes work fine over MEM_SET, only reads are the hardware loss (Pitfall 3)"

patterns-established:
  - "capability-registry.ts is the ONE place per-backend capability data lives; plans 08-02 (runtime wiring), 08-03 (generated support table), 08-04 (skill-text lint) all consume it, none re-derive it"

requirements-completed: [BACK-05]

# Metrics
duration: 61min
completed: 2026-08-18
---

# Phase 8 Plan 01: Capability Registry Summary

**`capability-registry.ts` -- a 26-entry, three-category (hardware/descoped/stock-only-gain) per-backend capability lookup with a `capabilityRefusalMessage()` renderer mirroring `vice.ts`'s `DENY_LIST` pattern, proven complete against both shipped manifests by a 9-case automated test.**

## Performance

- **Duration:** 61 min (21:01 -> 22:02, including reading/verification)
- **Started:** 2026-08-18T21:01:43+02:00 (base commit)
- **Completed:** 2026-08-18T22:01:52+02:00 (final task commit)
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 edited)

## Accomplishments
- `CAPABILITY_REGISTRY` (26 entries) is the single runtime-importable source of truth for the fork/stock capability delta -- no second copy exists anywhere in the repo.
- `capabilityRefusalMessage()` renders three distinguishable wordings (hardware/descoped/stock-only-gain), mechanically distinguishable by the presence/absence of the literal token `unrecoverable`.
- A 9-case automated test proves the message shapes, the `undefined` contract (unknown name, synthetic-tool guard, same-backend miss), the `DENY_LIST` boundary, and mechanical completeness against `tools-manifest.json`/`tools-manifest.stock.json` -- with a non-vacuity control so a broken manifest read cannot pass silently.
- The module ships: `package.json`'s `files[]` gained the entry, and `check-npm-packages.mjs` gained a dedicated regression guard, both proven to fail loudly when reverted (see below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create capability-registry.ts -- 26 entries, 3 reason categories, one message function** - `9f87db6` (feat)
2. **Task 2: capability-registry.test.ts -- message shape, undefined contract, synthetic-tool guard, mechanical completeness** - `383ae23` (test)
3. **Task 3: Ship the module -- files[] entry plus the packaging regression guard** - `c91588a` (chore)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `.claude/mcp/vice/capability-registry.ts` - `CapabilityCategory`, `CapabilityEntry`, `CAPABILITY_REGISTRY` (26 entries), `capabilityEntryFor()`, `capabilityRefusalMessage()`
- `.claude/mcp/vice/capability-registry.test.ts` - 9 `node:test` cases; automated mirror for plan 08-02's manual-only `vice-proxy.test.ts` assertions
- `.claude/mcp/vice/package.json` - `capability-registry.ts` added to `files[]`, next to `stock-dispatch.ts`
- `scripts/check-npm-packages.mjs` - `["capability-registry.ts", "BACK-05"]` added to `REQUIRED_DERIVED_MODULES`

## Exported Signature List (for plans 08-02/03/04)

```typescript
export type CapabilityCategory = "hardware" | "descoped" | "stock-only-gain";
export interface CapabilityEntry {
  name: string;
  category: CapabilityCategory;
  providedBy: ViceBackend;   // the backend that DOES have it
  reason: string;
  alternative?: string;
}
export const CAPABILITY_REGISTRY: readonly CapabilityEntry[]; // 26 entries
export function capabilityEntryFor(name: string): CapabilityEntry | undefined;
export function capabilityRefusalMessage(name: string, activeBackend: ViceBackend): string | undefined;
```

## The Three Final Message Wordings (verbatim, current templates)

**hardware** (e.g. `capabilityRefusalMessage("vice_sid_get_state", "stock")`):
> `vice_sid_get_state is unrecoverable on the stock backend: SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes no SID read command. Use the fork backend instead (Set VICE_BACKEND=fork).`

**descoped** (e.g. `capabilityRefusalMessage("vice_memory_fill", "stock")`):
> `vice_memory_fill is not implemented on the stock backend: No shipped skill calls it. Use the fork backend instead (Set VICE_BACKEND=fork).`

(A descoped entry with an `alternative`, e.g. `vice_keyboard_matrix`, appends one more sentence naming `vice_keyboard_type`/`vice_keyboard_petscii`/`vice_joystick_set` and the "polling $DC00/$DC01 directly" caveat.)

**stock-only-gain** (e.g. `capabilityRefusalMessage("vice_execution_until_return", "fork")`):
> `vice_execution_until_return is not implemented on the fork backend: The fork's custom HTTP API has no equivalent RPC; this is the native EXECUTE_UNTIL_RETURN opcode. Use the stock backend instead (Set VICE_BACKEND=stock).`

## Confirmed Line Numbers (for plan 08-03's consolidation task)

`FORK_ONLY_UNRECOVERABLE` in `scripts/check-skill-tool-coverage.mjs` is at **lines 171-184** (confirmed this session, matches the plan's own re-verification note -- not the research doc's originally-cited 141-159, which had already drifted before this plan started).

## Transient-Edit Failure Messages (proved, then reverted)

**Task 2 -- deleting `vice_registers_available` from `CAPABILITY_REGISTRY`** made the completeness test fail with:
```
CAPABILITY_REGISTRY has drifted from the two shipped manifests: an unregistered divergence means
adding an entry to CAPABILITY_REGISTRY; a stale entry means a phase has landed the capability on
both backends and the entry must be deleted.
```
(diff showed `vice_registers_available` present in `expected` but missing from `actual`)

**Task 2 -- adding a synthetic `vice_diagnose` entry to `CAPABILITY_REGISTRY`** made the synthetic-tool guard fail with:
```
vice_diagnose/vice_recycle are synthetic, proxy-local tools registered on BOTH backends by
vice-proxy.ts's two buildBackendAwareTool(...resolveAdvertisedToolDefinition(...)) registration
call sites -- they are not a capability gap, and must never appear in this registry.
```
(the same edit also failed the completeness test, since the injected name is excluded from `expected`)

**Task 3 -- removing `"capability-registry.ts"` from `package.json`'s `files[]`** made `check-npm-packages.mjs` fail with:
```
check-npm-packages: FAIL
  - vice-mcp: missing capability-registry.ts -- BACK-05 would ship a package that throws ERR_MODULE_NOT_FOUND
```

All three edits were reverted immediately after capture; `git diff --stat` confirmed a clean revert in each case before proceeding.

## Decisions Made
- `capabilityRefusalMessage()`'s `undefined` contract covers both "no entry" and "entry provides on the active backend already" in one guard, so the function can never be asked to render a wording for a tool the caller's own backend already advertises.
- `vice_sid_set_state` and `vice_sid_get_state` were given deliberately distinct reason text (asserted `notEqual` in the test suite) so a reader cannot conflate "SID reads are unrecoverable" with "SID writes are also gone."
- `vice_diagnose`/`vice_recycle` are excluded from the registry entirely (never added with a neutralizing category) — the research's resolved Open Question 2 confirmed the refusal structurally cannot fire for them, so the exclusion is pinned by a test, not a runtime guard.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were verified directly (typecheck, unit tests, packaging checks, transient-edit proofs) with no auto-fixes required.

## Issues Encountered

`.claude/mcp/vice/node_modules` was absent at the start of execution (never committed, per this repo's convention) — ran `npm ci` once to provision it before the first `tsc`/`node --test` invocation. Not a deviation from the plan (routine environment setup, not a plan or code change).

`node test-gate.mjs`'s full automated run surfaces one pre-existing, unrelated failure in `repo-root.test.ts` ("the agreed directory must not sit under .claude"), caused by this execution's git worktree living at `.claude/worktrees/agent-a406ade8c1a574f31/` -- an artifact of worktree isolation itself, reproduced identically running `repo-root.test.ts` alone (a file with zero overlap with this plan's `files_modified`). Logged to `.planning/phases/08-capability-honesty-and-the-install-story/deferred-items.md` per the Scope Boundary rule; not auto-fixed. `capability-registry.test.ts` itself passes 9/9 in isolation and `check-npm-packages.mjs`/`check-skill-tool-coverage.mjs` both exit 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`capability-registry.ts` is ready for plan 08-02 to import into `vice-proxy.ts`'s `CallToolRequestSchema` override (the actual BACK-05 runtime wiring -- not built in this plan, per the plan's own scope). Plan 08-03 can consume `CAPABILITY_REGISTRY` directly for the generated support table (D-H: GitHub-only, not packaged). Plan 08-04's skill-text lint can cross-reference the registry's tool names.

No blockers. One out-of-scope, pre-existing test failure (`repo-root.test.ts`, worktree-path-caused) is documented in `deferred-items.md` for whoever next runs the full suite outside a nested worktree path.

---
*Phase: 08-capability-honesty-and-the-install-story*
*Completed: 2026-08-18*
