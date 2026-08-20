---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 11
subsystem: regenerator2000-integration
tags: [regenerator2000, vice-symbols, stock-vice, fork-vice, live-walkthrough, r2000, back-02]

# Dependency graph
requires:
  - phase: 11-08
    provides: "export-lbl/import-lbl CLI verbs plus r2000-symbols.ts's exportLabels()/importLabels()/regenerateAndReload() -- the mechanism this plan drives live"
  - phase: 11-07
    provides: "the committed recon-subject.prg/regen2000proj fixture used as this plan's live subject (branch 2 of the objective's resolution rule)"
provides:
  - "A 23-step live walkthrough (WALKTHROUGH.md) proving criterion 4 as ONE closed loop -- absence proven before live discovery, discovery before naming, naming before regeneration, regeneration before a single vice_symbols_load -- against genuine unpatched stock x64sc (VICE 3.9) and a real regenerator2000 0.9.20"
  - "BACK-02's standing per-phase regression gate result for Phase 11 (BACK-02-GATE.md), including a live fork-backend (VICE 3.10) confirmation that the fork's own symbol implementation is unregressed"
  - "A reproduced, logged instance of the documented FINDING-C1 defect (missing -drive8type 1541) hit and fixed live during this plan's own launch, not merely cited"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Driving stock-connect.ts/stock-dispatch.ts directly from a throwaway script (bypassing vice-proxy.ts's stdio JSON-RPC framing, which needs @mastra/mcp) to get a live, real-emulator transcript without a nested interactive session -- the same pattern stock-live.test.ts already established for its own before()/withOwnStockInstance() fixtures"
    - "A pre-discovery, post-outbound project snapshot (subject-copy.regen2000proj) so the --import_lbl leg can be demonstrated on an independent copy without depending on the canonical r2000_set_label_name path's own state"

key-files:
  created:
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/WALKTHROUGH.md
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/BACK-02-GATE.md
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/outbound.lbl
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/regenerated.lbl
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/subject.prg
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/subject.regen2000proj
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/subject-copy.regen2000proj
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/copy-pre-import.lbl
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/copy-post-import.lbl
  modified: []

key-decisions:
  - "Used plan 11-07's committed recon-subject.prg/regen2000proj as the live subject (objective's branch 2) -- verified directly that no consuming project has a registered real release on this host (recovery/RELEASES.json does not exist), so branch 1 does not apply."
  - "Picked the outbound label address (2105/$0839) and the to-be-discovered address (2118/$0846) by reading the fixture's own source, but treated 2118's NAME as genuinely discovered: the address itself was surfaced live via vice_disassemble's resolvedTarget field on a real beq operand, and named only after that live observation, not read off the source file."
  - "Drove the live VICE half by importing stock-connect.ts/stock-dispatch.ts directly in a throwaway script rather than through vice-proxy.ts's stdio JSON-RPC layer -- avoids a nested interactive MCP session (explicitly forbidden for this plan) while still exercising the real wire protocol and the real dispatch table, matching stock-live.test.ts's own established pattern."
  - "Snapshotted the project (subject-copy.regen2000proj) immediately after the outbound label was written but before the discovery leg, so the --import_lbl demonstration in Task 2 is on an independent copy whose only prior state is the outbound label -- not entangled with the canonical r2000_set_label_name path's own mutations."

patterns-established:
  - "A live walkthrough plan drives the same production dispatch tables (stockConnect/dispatchStock) a test fixture would, from a standalone script, when a nested interactive session is forbidden and the CLI's own stdio server has a runtime dependency (@mastra/mcp) not needed for the underlying calls."

requirements-completed: [R2000-14, R2000-15]

# Metrics
duration: ~30min
completed: 2026-08-20
---

# Phase 11 Plan 11: Criterion 4 Live Walkthrough Summary

**A 23-step live transcript closes the R2000-14/R2000-15 symbol loop end to end against genuine unpatched stock x64sc (VICE 3.9) and a real regenerator2000 0.9.20: a store-written label resolves live, a name discovered by disassembling the running program (never read off source) gets written back into the store, and BACK-02's fork-backend regression gate is independently reconfirmed live against genuine VICE 3.10.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-20
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 9 (9 created, 0 modified)

## Accomplishments

- **The outbound leg:** wrote `counter_wrap_reentry` at `$0839` into the store via `r2000_set_label_name`, exported it via the real `vice-mcp r2000 export-lbl` CLI verb, then loaded it into a genuinely launched, real stock `x64sc` and confirmed `vice_symbols_lookup` resolves it to the exact address written -- plus a live `vice_disassemble` read at that address showing real program bytes underneath the label, not merely an asserted number.
- **The inbound leg, with the absence proven before the discovery:** confirmed (both against the store via `r2000_get_symbols` and against the exported `.lbl` file) that no user label existed at `$0846` before disassembling the running program's `main_loop` live and observing its `beq` branch to that exact address (`resolvedTarget: 2118` read directly off the real disassembler). Disassembling `$0846` itself showed real reachable code, independently resolving an ambiguity plan 11-07's own recon session had explicitly flagged `[unknown]` at that address. Named it `selector_ff_handler` from that live observation, wrote it into the store, regenerated the whole label file (D-29, 9 symbols), and called `vice_symbols_load` on it exactly once (2 total occurrences across the whole transcript). Also exercised `--import_lbl` explicitly on an independent project copy, with a fresh `export-lbl` from that copy confirming the discovered name persisted.
- **BACK-02's standing gate, fully run and recorded:** `test:automated` (1893/1899, the one failure being the pre-existing worktree-only `repo-root.test.ts` case already documented in 11-08-SUMMARY.md), clean `typecheck`, `smoke` OK, `check-npm-packages.mjs` OK, the fork manifest's 62-count and stock dispatch's 38-count both unchanged, and a live check against genuine fork VICE 3.10 confirming its own `vice_symbols_load`/`lookup` implementation is unregressed.
- **A real defect hit and fixed live, not merely cited:** the first launch attempt (missing `-drive8type 1541`) reproduced the documented FINDING-C1 failure mode outright -- `vice_autostart` failed at the wire with `CMD_FAILURE (0x8f)` -- confirming the fix is still load-bearing on this exact stock binary, not just historically true.

## Task Commits

1. **Task 1: the outbound leg -- a store label resolves a live address on genuine stock** - `ef275af` (test)
2. **Task 2: the inbound leg -- a name discovered against the running machine ends up in the store** - `f631dfb` (test)
3. **Task 3: BACK-02's standing gate and the evidence ceiling** - `37c26a5` (docs)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `.planning/phases/.../evidence/criterion4/WALKTHROUGH.md` - New. The single ordered 23-step transcript: subject resolution, banners, the outbound leg, the absence-before proof, the live discovery, the regenerated-file reload, the `--import_lbl` leg, the verdict, the logged deviation, and the evidence ceiling.
- `.planning/phases/.../evidence/criterion4/BACK-02-GATE.md` - New. The standing regression gate's quoted results for this phase, including the live fork-backend check.
- `.planning/phases/.../evidence/criterion4/outbound.lbl` - New. 8 user labels, produced by the real `export-lbl` CLI verb.
- `.planning/phases/.../evidence/criterion4/regenerated.lbl` - New. 9 user labels (outbound's 8 plus the discovered `selector_ff_handler`), produced by `regenerateAndReload()`'s export half.
- `.planning/phases/.../evidence/criterion4/subject.prg` / `subject.regen2000proj` - New. Copies of plan 11-07's committed fixture, mutated only inside this plan's own evidence directory.
- `.planning/phases/.../evidence/criterion4/subject-copy.regen2000proj` - New. A snapshot taken after the outbound label but before the discovery, used for the independent `--import_lbl` demonstration.
- `.planning/phases/.../evidence/criterion4/copy-pre-import.lbl` / `copy-post-import.lbl` - New. Before/after exports from the copy, proving the `--import_lbl` leg actually persisted the discovered name.

## Decisions Made

See `key-decisions` in the frontmatter above. The most load-bearing one: the discovery's live-ness rests entirely on the ADDRESS being surfaced by the real disassembler's `resolvedTarget` field on a genuine `beq` read off the running machine -- the NAME chosen afterward is ours, same as any recon session, but the address was never read off the source file first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Missing `-drive8type 1541` in the initial live launch argv**
- **Found during:** Task 1/2 (the live half, first launch attempt)
- **Issue:** The first attempt launched stock `x64sc` with `-default -binarymonitor -binarymonitoraddress ...` (no drive-type flag). `vice_autostart` failed outright: `"binary monitor returned error code 0x8f for response type 0x00"`. This is the documented FINDING-C1 defect (`broker-launch.mts`'s own header comment, Phase 8.1/8.2 fix): a stock `x64sc` boots with `Drive8Type=0` by default, so `AUTOSTART` fails for ANY program load (disk or bare `.prg`), and no stock MCP tool can correct it after boot.
- **Fix:** Added `-drive8type 1541` immediately after `-default` in this walkthrough's own throwaway launch script, matching `broker-launch.mts:198`'s already-fixed production argv exactly, and re-ran the entire live sequence from scratch. The first attempt's reads (all-zero/`brk` bytes, since the program never actually loaded) were discarded, not reported, and are not part of the numbered transcript.
- **Files modified:** none in the repository -- only this walkthrough's own scratch driver script (outside `.planning/`, never committed) was corrected. `broker-launch.mts` itself was not touched; its argv was already correct and is what this fix matched.
- **Verification:** Re-run live: `vice_autostart` returned `runState: "running"`, and subsequent `vice_disassemble` calls read real program bytes matching the fixture's own source exactly.
- **Committed in:** `f631dfb` (the corrected argv and its outcome are recorded in `WALKTHROUGH.md`'s own "Deviation logged during this walkthrough" section, part of the Task 2 commit since the whole transcript is one file).

---

**Total deviations:** 1 auto-fixed (1 blocking issue, reproducing an already-documented defect on this exact binary rather than introducing a new one).
**Impact on plan:** No scope creep -- the fix stayed inside this walkthrough's own throwaway script and matched an already-landed, already-correct production argv (`broker-launch.mts`). No repository code was changed.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required. `regenerator2000 0.9.20`, genuine stock `x64sc` (`/usr/bin/x64sc`, VICE 3.9) and the fork build (`/usr/local/bin/x64sc`, VICE 3.10) were all already present on this host, and `.claude/mcp/vice/node_modules` was provisioned via `npm ci` (gated by the lockfile hash, per this project's own `ensure-mcp-deps.sh` convention) so `vice-proxy.ts r2000 export-lbl`/`import-lbl` could run as real CLI subprocesses.

## Next Phase Readiness

- Criterion 4 (`R2000-14`/`R2000-15`) is now proven end to end, live, as one closed loop, not merely by the committed-fixture test plan 11-08 already landed. The evidence ceiling is stated explicitly in `WALKTHROUGH.md`: proven against a real emulator and a real regenerator2000 0.9.20 on a 102-byte purpose-built fixture; not proven against a commercial release's size, packing or self-modification. Raising that ceiling needs a registered real release in a consuming project's `recovery/RELEASES.json` (branch 1 of the objective's own resolution rule, which does not apply on this host).
- `T-11-NAME-INJECT` (label names unvalidated on entry, first flagged in 11-08-SUMMARY.md) remains open and is noted again here per the plan's own instruction, not re-covered -- both names this walkthrough introduced were deliberately ordinary, well-formed identifiers.
- The pre-existing, worktree-only `repo-root.test.ts` failure (documented in 11-08-SUMMARY.md's own "Next Phase Readiness") is still present and still not caused by this plan.
- No emulator process was left running: `pgrep -af x64sc` confirmed empty after both the stock and fork live sessions.

## Self-Check: PASSED

- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/WALKTHROUGH.md`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/BACK-02-GATE.md`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/outbound.lbl`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion4/regenerated.lbl`
- FOUND commit `ef275af` (Task 1)
- FOUND commit `f631dfb` (Task 2)
- FOUND commit `37c26a5` (Task 3)

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*
