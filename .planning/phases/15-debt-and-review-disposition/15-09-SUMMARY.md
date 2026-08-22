---
phase: 15-debt-and-review-disposition
plan: 09
subsystem: testing
tags: [capability-registry, stock-dispatch, gains-protocol, warp, vice-ping, docs-guards]

requires:
  - phase: 15-03
    provides: "The generator's cell()-escaping fix and the byte-identity guard on docs/tool-support.md that this plan's registry-text edit regenerates against"
  - phase: 15-07
    provides: "STATE.md's Deferred Items ledger baseline (pending 12, total 13) that this plan's two todo closures decrement from"
provides:
  - "GAINS-PROTOCOL.md's warp section states the measured 2026-08-20 stock-3.10 error codes (0x01 for RESOURCE_GET/string-set, 0x8f only for int-set) instead of a wrong source prediction, and records the InitialWarpMode silent-success trap plus the launch-time-only-result tool-behaviour decision"
  - "vice_machine_config_set's WarpMode capability is caveated fork-only in two project-owned places (docs/stock-vice-parity.md's licensed-divergence register, capability-registry.ts's existing reason text) with no schema growth; docs/tool-support.md regenerated with a minimal diff; tools-manifest.json left untouched"
  - "vice_ping's resolvedBinaryPath is documented as a one-time MCP-server-startup PATH probe both at its definition (vice-proxy.ts) and in the response itself (a new resolvedBinaryPathScope sibling field), pinned by a new non-hanging test file"
  - "Both pending todos (warp-over-resource-set-refuted, vice-ping-resolvedbinarypath-misleading) closed with cited Resolutions; STATE.md's Deferred Items ledger reconciled (pending 12->10, total 13->11)"
affects: [15-11, 15-12]

actuals:
  tokens: 9287
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Fork-only caveat lands in existing text fields, never a new schema field: capability-registry.ts's CapabilityEntry.reason already reaches both capabilityRefusalMessage() and the generated support table, so a fork-side SKILL-01 hazard is caveated by extending that one field rather than growing the schema."
    - "Additive, backward-compatible response documentation: vice_ping's resolvedBinaryPathScope is a NEW sibling field, never a rename of the existing resolvedBinaryPath/resolvedBinaryPathIsResolved fields a caller may already read."
    - "Planted-violation non-vacuity for a documentation field: temporarily removing the production line that renders the new field, confirming the pinning test reddens against the identical code path, then restoring -- applied to vice-proxy-ping.test.ts exactly as prior phases applied it to code-behavior tests."

key-files:
  created:
    - .claude/mcp/vice/vice-proxy-ping.test.ts
  modified:
    - .planning/research/GAINS-PROTOCOL.md
    - docs/stock-vice-parity.md
    - .claude/mcp/vice/capability-registry.ts
    - docs/tool-support.md
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/stock-dispatch.ts
    - CLAUDE.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md
    - .planning/todos/completed/2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool.md

key-decisions:
  - "The Tier 4 table's plan-cited 'launch-time warp resource row' did not exist as a separate row in the current source (only a WarpMode row saying 'does not exist' and a Speed row mentioning InitialWarpMode in passing) -- extended the WarpMode row itself with the silent-success trap and the decision sentence, rather than inventing a row shape the plan assumed but the source did not have."
  - "Decision recorded in both GAINS-PROTOCOL.md and the closed todo: a stock-backend resource-set tool should return an explicit launch-time-only result for InitialWarpMode rather than a bare refusal -- a refusal is indistinguishable from an unsupported resource, and this one genuinely exists and is genuinely settable, just not effective until relaunch."
  - "Item 5 (whether a runtime InitialWarpMode set has any measurable effect on emulation speed) is promoted as a named follow-on with an explicit owner description (whichever future plan next needs stock warp/speed control) rather than measured here or silently dropped -- it was the one thing the 2026-08-20 probe left open and the plan's own instruction was to promote, not implement, it."
  - "vice_ping's resolvedBinaryPath fix is documentation, not a per-request broker requery: the requery alternative is a real behavioural change to a reporting field, explicitly rejected as out of a disposition phase's remit, on the record in both vice-proxy.ts's comment and the closed todo's Resolution."
  - "A new sibling field (resolvedBinaryPathScope), not a rename: the existing resolvedBinaryPath/resolvedBinaryPathIsResolved field names and shapes are preserved so no caller reading the current response shape breaks."

patterns-established:
  - "A documentation-only field addition to a stable response shape is proven non-vacuous the same way a behavior fix is: plant the removal in production code, confirm the pinning test reddens, restore, confirm green -- never trust a single post-fix green run for an honesty-preserving field."

requirements-completed: [DEBT-01, DEBT-02]

coverage:
  - id: D1
    description: "GAINS-PROTOCOL.md's warp section corrected to the measured 2026-08-20 stock-3.10 error codes (0x01 object-does-not-exist for RESOURCE_GET/string-set, 0x8f invalid-parameter only for int-set), cited by date and binary rather than left a source prediction; three pre-existing correct launch-time-only statements confirmed unmodified"
    requirement: DEBT-02
    verification:
      - kind: other
        ref: "grep -c '0x01' in the warp section >= 1; grep -c '2026-08-20' in GAINS-PROTOCOL.md == 2; git diff shows changes confined to the two edited regions"
        status: pass
      - kind: integration
        ref: "cd .claude/mcp/vice && node --test docs-linerefs.test.ts docs-dangling-refs.test.ts && npm run test:automated"
        status: pass
    human_judgment: false
  - id: D2
    description: "InitialWarpMode's silent-success trap (runtime set succeeds and reads back, but only takes effect at launch) recorded in GAINS-PROTOCOL.md's Tier 4 WarpMode row, plus the tool-behaviour decision: return an explicit launch-time-only result, not a bare refusal"
    requirement: DEBT-02
    verification:
      - kind: other
        ref: "sed -n '1352,1361p' GAINS-PROTOCOL.md | grep -ci 'reads back' == 1; decision sentence present naming launch-time-only-result with a reason"
        status: pass
    human_judgment: false
  - id: D3
    description: "vice_machine_config_set's advertised WarpMode capability marked fork-only in docs/stock-vice-parity.md's licensed-divergence register (SS A item 7) and in capability-registry.ts's existing reason text (no new schema field); docs/tool-support.md regenerated with a minimal, single-row diff; tools-manifest.json confirmed byte-identical"
    requirement: DEBT-02
    verification:
      - kind: other
        ref: "grep -ci 'fork-only' docs/stock-vice-parity.md >= 1; git diff --quiet .claude/mcp/vice/tools-manifest.json; git diff docs/tool-support.md limited to the one changed note cell"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test tool-support-table.test.mjs capability-registry.test.ts stock-dispatch.test.ts (150/150 pass)"
        status: pass
      - kind: other
        ref: "capabilityRefusalMessage('vice_machine_config_set', 'stock') renders the fork-only caveat text verbatim -- quoted in this SUMMARY's Task Detail below"
        status: pass
    human_judgment: false
  - id: D4
    description: "vice_ping's resolvedBinaryPath documented as a one-time MCP-server-startup PATH probe at its definition (vice-proxy.ts comment) and in the response (new resolvedBinaryPathScope field), pinned by a non-hanging test proven non-vacuous by a planted-violation probe; response shape stays backward-compatible"
    requirement: DEBT-01
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test vice-proxy-ping.test.ts (2/2 pass)"
        status: pass
      - kind: other
        ref: "planted-violation: removing the resolvedBinaryPathScope line reddened the test (AssertionError: expected 'string', actual 'undefined'); restoring returned it to green"
        status: pass
      - kind: integration
        ref: "cd .claude/mcp/vice && npm run typecheck && npm run test:automated (2112/2107/0/5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both pending todos closed with cited Resolutions; STATE.md's Deferred Items ledger table and both of its prose count figures reconciled in the same commit set (pending 12->10, total 13->11)"
    requirement: null
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts (4/4 pass, both directions)"
        status: pass
    human_judgment: false

duration: 40min (approx.)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 9: Close DEBT-02's Warp Documentation Defects and DEBT-01's vice_ping Documentation Todo Summary

**Corrected GAINS-PROTOCOL.md's predicted warp error codes to the measured 2026-08-20 stock-3.10 values, caveated `vice_machine_config_set`'s WarpMode capability fork-only in two project-owned places with no schema growth, and documented `vice_ping`'s `resolvedBinaryPath` as a one-time startup probe both at its definition and in the response itself — closing both of DEBT-02's/DEBT-01's remaining pending todos.**

## Performance

- **Duration:** 40 min (approx.)
- **Completed:** 2026-08-22T18:52:57+02:00
- **Tasks:** 3 completed
- **Files modified:** 10 (1 created, 9 modified, across 3 commits)

## Accomplishments

- **Task 1 (GAINS-PROTOCOL.md corrections):** Replaced the wrong single-error-code prediction (`RESOURCE_SET WarpMode 1` "will fail with `0x8f`") with the measured 2026-08-20 codes against genuine unpatched stock `/usr/bin/x64sc` (VICE 3.10): `0x01` (object does not exist) for `RESOURCE_GET WarpMode` and a string-typed `RESOURCE_SET WarpMode "1"`; `0x8f` (invalid parameter) only for an int-typed `RESOURCE_SET WarpMode 1`. Extended the Tier 4 `WarpMode` row (the plan's cited "launch-time warp resource row" did not exist separately in current source — the nuance was folded into the existing `WarpMode` row instead) with the `InitialWarpMode` silent-success trap: a runtime set returns success and reads back as set, but per `vsync.c:207-209` only the launch-time value is ever consulted, so the readback proves nothing about the running instance's actual speed. Recorded the tool-behaviour decision: a stock-backend resource-set tool should return an explicit launch-time-only result for `InitialWarpMode`, not a bare refusal. Confirmed the three other launch-time-only statements (`GAINS-PROTOCOL.md:1487-1489`, `:1521-1524`, `CLAUDE.md`'s Capability constraint, `PROJECT.md`) unmodified and still correct — `git diff` confined to the two edited regions.
- **Task 2 (fork-only caveat, two project-owned places):** Added a bullet to `docs/stock-vice-parity.md` §A item 7's licensed-divergence register naming `vice_machine_config_set`'s advertised `WarpMode` fork-only, that stock has no runtime warp resource at all, and that warp on stock is a launch-time flag only — citing the 2026-08-20 probe and the SKILL-01 hazard. Extended `capability-registry.ts`'s existing `vice_machine_config_set.reason` field (no new schema field — `grep -c 'note:'` unchanged at 0) with the same caveat in two sentences, reaching a stock caller through `capabilityRefusalMessage()`:
  ```
  vice_machine_config_set is not implemented on the stock backend: Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist subset that never shipped on stock. Its advertised WarpMode resource is fork-only: stock has no runtime warp resource at all, and warp on stock is a launch-time flag, not a resource that can be toggled while running. Use the fork backend instead (Set VICE_BACKEND=fork).
  ```
  Regenerated `docs/tool-support.md`; the diff is exactly the one changed note cell:
  ```
  | vice_machine_config_set | ✅ | — | not yet built (descoped): Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist subset that never shipped on stock. Its advertised WarpMode resource is fork-only: stock has no runtime warp resource at all, and warp on stock is a launch-time flag, not a resource that can be toggled while running. |
  ```
  `tools-manifest.json` deliberately left untouched (`git diff --quiet` confirms byte-identical) — it is generated from the fork binary's own compiled schema. Closed the warp todo with a `## Resolution` naming all five original Solution items and promoting item 5 (measuring whether a runtime `InitialWarpMode` set changes anything) as a named follow-on rather than dropping it.
- **Task 3 (vice_ping documentation):** Added a comment block at `vice-proxy.ts`'s module-scope `ACTIVE_BACKEND` resolution (line 316) naming `resolvedBinaryPath` a one-time, MCP-server-process-startup `$PATH` probe independent of the broker's leased instance, and pointing to `epoch.json`'s `vice_bin` field (written by `broker-epoch.mts`) as the authoritative per-instance answer — citing Phase 8.2 plan 04's walkthrough as the precedent that had to route around this field. Added an additive `resolvedBinaryPathScope` sibling field to `vice_ping`'s response (`stock-dispatch.ts`'s `handlePing()`) carrying the same qualification; the existing `resolvedBinaryPath`/`resolvedBinaryPathIsResolved` fields and names are unchanged. New test file `vice-proxy-ping.test.ts` (never `vice-proxy.test.ts`, which hangs) pins both the new field's content and the unchanged shape of the existing fields — confirmed in the automated set (absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`). Closed the `vice_ping` todo with a `## Resolution` naming both documentation locations, the rejected per-request-requery option, and the authoritative alternative.
- **Deviation caught and fixed in-task:** Task 3's own comment insertion at `vice-proxy.ts:316` shifted every subsequent line number by +17, breaking `docs-linerefs.test.ts`'s two `rewriteArguments()` citations in `CLAUDE.md` (`:3029`/`:2964`/`:1508`/`:1484` all stale). Caught immediately by re-running the full automated suite before committing; corrected the four citations to their new real lines (`:3046`/`:2981`/`:1525`/`:1501`) in the same commit.
- `npm run typecheck` and `npm run test:automated` (`.claude/mcp/vice`) both exit 0 after every task: final state 2112 tests / 2107 pass / 0 fail / 5 pre-existing todo (up from 15-07's 2110/2105/0/5 — 2 new tests added, both passing).
- `STATE.md`'s `## Deferred Items` ledger reconciled: both pending todos this plan closed removed from the table, both prose count figures updated (pending 12 → 10, total 13 → 11), and a historical prose mention of the warp todo's stem reworded to a paraphrase (matching 15-07's established pattern) so `docs-deferred-ledger.test.ts`'s completed-stem check does not trip. `node --test docs-deferred-ledger.test.ts` confirmed 4/4 pass in both directions.
- **DEBT-01 and DEBT-02 are NOT marked complete** — both are shared requirement IDs still declared by sibling plans 15-11 and 15-12 per the shared-ID gate (#2388); `requirements.ready-ids` correctly withholds them.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct GAINS-PROTOCOL.md's predicted error codes and record the launch-only silent-success trap** - `d6a9c53` (fix)
2. **Task 2: Mark the fork tool's warp capability fork-only in two project-owned places and regenerate the support table** - `602f9cb` (fix)
3. **Task 3: Name vice_ping's resolvedBinaryPath honestly at its definition and in its response** - `7c53160` (fix)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.planning/research/GAINS-PROTOCOL.md` - corrected warp error codes with dated citation; extended Tier 4 WarpMode row with the InitialWarpMode silent-success trap and tool-behaviour decision
- `docs/stock-vice-parity.md` - new fork-only-warp bullet in §A item 7's licensed-divergence register
- `.claude/mcp/vice/capability-registry.ts` - extended `vice_machine_config_set.reason` with the fork-only warp caveat (existing field, no schema growth)
- `docs/tool-support.md` - regenerated; diff limited to the one changed note cell
- `.claude/mcp/vice/vice-proxy.ts` - comment at `ACTIVE_BACKEND`'s module-scope resolution documenting the startup-probe nature of `resolvedBinaryPath`
- `.claude/mcp/vice/stock-dispatch.ts` - new additive `resolvedBinaryPathScope` field on `vice_ping`'s response
- `.claude/mcp/vice/vice-proxy-ping.test.ts` - new focused, non-hanging test pinning the new field and the unchanged existing fields
- `CLAUDE.md` - corrected four stale `vice-proxy.ts:<N>` line citations after Task 3's own comment insertion shifted them
- `.planning/STATE.md` - Deferred Items ledger reconciled (pending 12→10, total 13→11); one historical stem mention reworded
- `.planning/todos/completed/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` - moved from `pending/`; `## Resolution` cites `d6a9c53`/`602f9cb`
- `.planning/todos/completed/2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool.md` - moved from `pending/`; `## Resolution` cites `7c53160`

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) the Tier 4 table's assumed separate "launch-time warp resource" row did not exist in current source — extended the real `WarpMode` row instead of inventing a row shape; (2) recorded a stock-backend resource-set tool should return an explicit launch-time-only result rather than a bare refusal for `InitialWarpMode`; (3) item 5 (measuring a runtime warp set's actual effect) promoted as a named follow-on, not implemented or dropped; (4) `vice_ping`'s fix is documentation, not a per-request broker requery — the requery alternative is a real behavioural change explicitly rejected as out of scope; (5) the new `resolvedBinaryPathScope` field is additive, never a rename, preserving backward compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CLAUDE.md's stale `rewriteArguments()` line citations after Task 3's own edit shifted them**
- **Found during:** Task 3 (documenting `vice_ping`'s `resolvedBinaryPath`)
- **Issue:** Adding a 17-line comment block at `vice-proxy.ts:316` shifted every subsequent line number, breaking `docs-linerefs.test.ts`'s mechanical check of `CLAUDE.md`'s `rewriteArguments()` bullet (citations `:3029`/`:2964`/`:1508`/`:1484` no longer pointed at the cited call sites/function starts).
- **Fix:** Updated the four citations to their new real lines (`:3046`/`:2981`/`:1525`/`:1501`), verified against the shifted source.
- **Files modified:** `CLAUDE.md`
- **Verification:** `cd .claude/mcp/vice && node --test docs-linerefs.test.ts` (3/3 pass, including the planted-violation non-vacuity test)
- **Committed in:** `7c53160` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Self-inflicted by this plan's own Task 3 edit; caught before commit by re-running the full automated suite, not left for a later plan to discover. No scope creep.

## Issues Encountered

None beyond the line-drift correction above, caught and fixed within Task 3's own commit before proceeding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both of this plan's pending todos are closed with cited, re-verified Resolutions. `docs-deferred-ledger.test.ts`, `docs-linerefs.test.ts`, and `docs-dangling-refs.test.ts` all run green. `npm run test:automated` confirmed at 2112 tests / 2107 pass / 0 fail / 5 pre-existing todo. `15-RESEARCH.md`'s Open Question 1 (where the WarpMode caveat belongs) is resolved: two project-owned places, no schema growth, generated artifacts left alone. DEBT-01 and DEBT-02 remain open pending sibling plans 15-11/15-12's own dispositions of their assigned todos. No blockers for the remaining phase 15 plans.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All modified/created files confirmed present on disk with expected content: `GAINS-PROTOCOL.md` (measured codes and Tier 4 trap present), `docs/stock-vice-parity.md` (fork-only bullet present), `capability-registry.ts` (warp caveat in `vice_machine_config_set.reason`, no `note:` field), `docs/tool-support.md` (byte-identical to a fresh regeneration), `vice-proxy.ts` (module-scope comment present, line citations shifted and corrected), `stock-dispatch.ts` (`resolvedBinaryPathScope` field present), `vice-proxy-ping.test.ts` (2/2 pass), `CLAUDE.md` (citations corrected), `STATE.md` (ledger reconciled), both completed todos (each with exactly one `## Resolution`, none remaining in `pending/`). All three task commits confirmed in `git log` (`d6a9c53`, `602f9cb`, `7c53160`). Plan-level `<verification>` re-run clean: `npm run typecheck` exits 0; `npm run test:automated` exits 0 (2112/2107/0/5); `git diff --quiet .claude/mcp/vice/tools-manifest.json` confirms byte-identity; `docs/tool-support.md` regenerated with `git diff --quiet` after; `node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts` all green.
