---
phase: 03-direct-tools
plan: 05
subsystem: docs
tags: [tools-manifest, parity-doc, decision-record, probe-debt, node-test]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "stock-dispatch.ts's STOCK_DISPATCH_TABLE, tools-manifest.stock.json (one entry), stock-protocol.ts's response parsers"
provides:
  - "A 62-tool fork manifest with vice_snapshot_list removed and a named regression gate (fork-manifest-surface.test.ts) protecting that count"
  - "docs/stock-vice-parity.md extended with every Phase 3 answer-shape divergence, default-value flip, approximation and manifest trim, each cited to its decision id"
  - "A pending todo tracking the four [ASSUMED] wire details (A1/A2/A3/A5) plus the A4 design choice as probe debt for a future hands-on session"
affects: [03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13, phase-08-parity-harness, phase-08-skill-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fork-surface regression gate: a single named test file asserting an exact tool count plus name/description invariants, replacing an assertion that never existed as a hard-coded literal anywhere in the repo"
    - "Decision-cited parity register: every stock-vs-fork divergence recorded in docs/stock-vice-parity.md names the decision id (D-0N) that licensed it, so Phase 8's parity harness can encode expectations instead of re-deriving them"

key-files:
  created:
    - .claude/mcp/vice/fork-manifest-surface.test.ts
    - .planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md
    - .planning/phases/03-direct-tools/deferred-items.md
  modified:
    - .claude/mcp/vice/tools-manifest.json
    - docs/stock-vice-parity.md

key-decisions:
  - "D-16 implemented: vice_snapshot_list deleted from the fork manifest (no consumer anywhere in the repo), vice_snapshot_load's description no longer references it, fork surface gated at exactly 62 tools"
  - "D-15's stale claim corrected: checkpoint_set_ignore_count is a trim, not a client-side hit-counting reimplementation, because counting would require a carve-out in D-05's absolute no-unrequested-resume policy"
  - "D-14's disk-attach approximation recorded with its exact limit: AUTOSTART has no drive-unit field, so units 9-11 refuse rather than silently retargeting to unit 8"
  - "Four ASSUMED wire details (A1 -remotemonitoraddress spelling, A2 ADVANCE_INSTRUCTIONS step-over, A3 JOYPORT_SET bit layout, A5 AUTOSTART fileIndex) plus the A4 design choice filed as high-priority probe debt, none claimed as verified"

patterns-established:
  - "Pattern: a fork-surface count gate is CREATED once, at the current correct number, with a header comment naming the decision that justifies any future change -- not edited from a prior hard-coded literal, since none existed"

requirements-completed: [DIRECT-03, DIRECT-06, DIRECT-07, DIRECT-08]

# Metrics
duration: 55min
completed: 2026-08-14
---

# Phase 3 Plan 05: Fork-Surface Gate and Parity Register Summary

**Deleted the unused `vice_snapshot_list` tool from the fork manifest, added a named 62-tool regression gate, and wrote every Phase 3 answer-shape divergence, default flip, approximation and trim into `docs/stock-vice-parity.md` with its licensing decision id, before any handler code exists to implement the contract.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-14T18:24:00Z (approx, worktree spawn)
- **Completed:** 2026-08-14T16:37:53Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 modified, 3 created)

## Accomplishments
- Fork manifest trimmed to 62 tools per D-16, with a named regression test (`fork-manifest-surface.test.ts`) that creates the count assertion for the first time (none existed as a hard-coded literal anywhere in the repo before this plan) and gates against `vice_snapshot_list` ever reappearing
- `docs/stock-vice-parity.md` now carries a complete, decision-cited licensed-divergence register (new section A item 7) covering D-01's stock-native answer shapes, D-06's `runState` field, D-05's read-halts-the-machine divergence (naming `c64-ram-capture`/`c64-program-recon` for SKILL-01), D-03's `run_after` default flip, D-14's disk-attach approximation, and every tool absent from the stock manifest
- One pending todo files all four `[ASSUMED]` wire details plus the A4 design choice as tracked probe debt, mirroring the shape of the two existing Phase 2 probe-debt todos and cross-referencing them

## Task Commits

Each task was committed atomically:

1. **Task 1: D-16 — delete vice_snapshot_list and gate the fork surface at 62 tools** - `f5c171d` (feat)
2. **Task 2: Record every Phase 3 divergence, approximation and trim in the parity doc** - `c2b90be` (docs)
3. **Task 3: File the four ASSUMED wire details as probe debt** - `6a423cf` (docs)

_No plan-metadata commit yet — this SUMMARY.md and its own commit follow immediately after this document._

## Files Created/Modified
- `.claude/mcp/vice/tools-manifest.json` - deleted the `vice_snapshot_list` entry; rewrote `vice_snapshot_load`'s trailing description sentence to stop referencing it
- `.claude/mcp/vice/fork-manifest-surface.test.ts` - new named regression gate: exact 62-tool count, `vice_snapshot_list` absence (by name and by raw text), `vice_snapshot_save`/`vice_snapshot_load` presence, unique-name + non-empty-description invariant for every entry
- `docs/stock-vice-parity.md` - corrected section A item 6 (ignore-count is a trim, not a reimplementation); added section A item 7, "Expected divergences licensed by design (Phase 3 — D-01, D-03, D-05, D-14)", covering every Phase 3 answer-shape divergence, default flip, absent tool, and D-14's disk-attach approximation with its exact limit
- `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md` - new pending todo, high priority, filing A1/A2/A3/A5 (wire assumptions) and A4 (design choice) with per-item failure modes, files to correct, and a numbered acceptance procedure
- `.planning/phases/03-direct-tools/deferred-items.md` - new file logging two out-of-scope, environment-only findings surfaced while verifying this plan (see Deviations below)

## Decisions Made
- Followed D-16 exactly: deletion plus description fix plus a *new* regression gate, since no prior hard-coded tool-count assertion existed anywhere in the repo to "move" — the plan's own read_first step confirmed this via `grep -rn '\b63\b' *.test.ts` finding nothing, and this SUMMARY's own verification independently re-confirmed it (the existing `stock-dispatch.test.ts` and `vice-proxy.test.ts` parity tests both compute names/counts dynamically from the manifest, never against a literal)
- Followed D-15/D-14/D-01/D-03/D-05/D-13's text exactly as specified in the plan's action blocks for the parity doc edit — no rewording of the plan's own decision framing was needed beyond fitting it into the document's existing voice
- Followed the plan's mirrored-shape instruction for the pending todo exactly, cross-referencing both existing Phase 2 probe-debt todos as required

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] This worktree's `.claude/mcp/vice/node_modules` was never provisioned**
- **Found during:** Task 1's verification (`node --test vice-proxy.test.ts` failed immediately with `ERR_MODULE_NOT_FOUND: Cannot find package '@mastra/mcp'`; `npm run test:automated` showed 28 pre-existing failures unrelated to any file this plan touches)
- **Issue:** `.claude/mcp/vice/node_modules` is gitignored and normally provisioned by the `ensure-mcp-deps.sh` `SessionStart` hook. This parallel-executor worktree never ran that hook and started with an empty `node_modules/.cache` and no installed packages.
- **Fix:** Confirmed `.claude/mcp/vice/package-lock.json` is byte-identical between the main checkout and this worktree (`diff` reported no differences), then copied the main checkout's already-`npm ci`'d `node_modules/` tree into the worktree via `cp -a` — no registry fetch, no new or unverified package, an exact copy of already-vetted packages matching the identical committed lockfile. This is provisioning already-locked dependencies, not installing a new package, so it is not excluded from Rule 3's package-manager-install carve-out.
- **Verification:** `npm run test:automated` failures dropped from 28 to 1 (the single worktree-path artifact documented below, itself unrelated to this plan); the manual-only `vice-proxy.test.ts` suite progressed from an immediate module-resolution crash to the documented "stalls outside the devcontainer" behavior at test 54+/110 (consistent with the existing disposition in `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`)
- **Files modified:** none committed (`node_modules/` is gitignored — this is a local environment fix only, logged to `deferred-items.md` for visibility)
- **Committed in:** not committed (gitignored); logged in `.planning/phases/03-direct-tools/deferred-items.md` item 2

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only, no committed file changes)
**Impact on plan:** Necessary to make this plan's own verification steps (the automated gate, the explicit manual-only suite run) mean anything at all. No scope creep — no source file this plan doesn't already own was touched.

## Issues Encountered

- **`repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails when run from inside this worktree, and only here.** Root cause: Claude Code's `isolation="worktree"` mechanism checks this worktree out at `<repo>/.claude/worktrees/agent-a0107c29833c910f2/`, so the worktree's own absolute path contains a literal `.claude/` segment — exactly the substring the test's regression guard checks for, even though the guard was written to catch a real path-anchor bug unrelated to worktree execution. Confirmed not a regression from this plan: the identical test passes (`ok 4`) when run from the main checkout with this plan's changes present, and `repo-root.ts`/`repo-root.test.ts` are untouched by any file this plan modifies. Logged to `.planning/phases/03-direct-tools/deferred-items.md` item 1 and left unfixed as out of scope (SCOPE BOUNDARY: this plan's changes are `tools-manifest.json`, `fork-manifest-surface.test.ts`, `docs/stock-vice-parity.md`, and the new pending todo only).
- **Existing item 1's "SID state read-back" heading check technically returns 2, not 1, per the plan's stated acceptance criterion.** This is a pre-existing artifact of the original document (the phrase appears once in the section's intro paragraph, line 9, and once in item 1's own heading, line 20) — unrelated to and unaffected by this plan's edits, which touched only item 6 and added item 7. Item 1's actual heading text is fully intact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The fork manifest and its regression gate are in place; any later plan in this phase that touches `tools-manifest.json` will trip `fork-manifest-surface.test.ts` if it accidentally changes the tool count or reintroduces `vice_snapshot_list`.
- `docs/stock-vice-parity.md` now documents every divergence the family plans (03-06 through 03-13) are expected to implement — those plans should implement the contract this document already states, not invent new divergences that then need retrofitting into the doc.
- The four ASSUMED wire details are tracked probe debt, not blockers; they do not gate any Phase 3 family plan's own verification, but Phase 3's overall verification block (already checked above) and 03-VALIDATION.md's Manual-Only Verifications table both point at this plan's new todo as the tracking artifact.
- Two roadmap reconciliations this phase's decisions require (DIRECT-06's detach half moving to Phase 7 per D-13, BACK-02's exception for `vice_snapshot_list` per D-16) are explicitly out of this plan's scope per the plan's own Scope Note — they are `gsd-sdk` roadmap edits for the orchestrator/a later step, not phase execution work.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/fork-manifest-surface.test.ts`
- FOUND: `.claude/mcp/vice/tools-manifest.json` (modified, 62 tools confirmed via `node -e`)
- FOUND: `docs/stock-vice-parity.md` (modified, section A item 7 present)
- FOUND: `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`
- FOUND: `.planning/phases/03-direct-tools/deferred-items.md`
- FOUND commit `f5c171d` (git log --oneline --all)
- FOUND commit `c2b90be` (git log --oneline --all)
- FOUND commit `6a423cf` (git log --oneline --all)

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*
