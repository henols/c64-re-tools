---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 09
subsystem: mcp-tooling
tags: [vice, text-monitor, live-verification, memmapshow, cpu-history, flat-profile, backtrace, register-decode, capability-probe]

# Dependency graph
requires:
  - phase: 42
    provides: "plan 42-01's parseAccessMap()/textmon-memmap.ts; plan 42-02/42-03's textmon-cpuhistory.ts/textmon-backtrace.ts/textmon-profile.ts/textmon-registers.ts; plan 42-04's buildTextCommand()/TEXT_COMMAND_PARAM_SPECS; plan 42-05's text-capability-probe.ts; plan 42-06's evidence record and corrected drift attributions; plan 42-07's five wired text tools"
provides:
  - "All five text formats proven to decode a reply produced live by genuine stock VICE on this host, not only from a committed fixture -- the path, not merely the shape"
  - "The capability probe proven live: all five commands answer capable and the real cache key names the resolved absolute binary path (D-42-2)"
  - "docs/phase42-text-format-drift-citations.md's own live-evidence section: seven MEASURED blocks plus a closing bound statement"
  - "textmon-profile.ts's FlatProfileEntry.address widened to number | \"ROOT\" -- a genuine live-discovered format variant (VICE's own synthetic top-level pseudo-frame), never captured by either committed fixture"
  - "TEXT_COMMAND_ALLOWLIST widened by prof on/prof off -- a conscious, measured widening, not a speculative one"
affects: []

# Actuals (#2632)
actuals:
  tokens: 10229
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Warm-up dial pattern: the first command issued after ANY halt-transition (cold boot, or a resume-then-halt) on stock VICE's text monitor carries an extra leading (C:$xxxx) prompt merged into the reply -- drained with one harmless, already-allowlisted dial before the command under test, rather than fixing every parser to tolerate a doubled prefix"

key-files:
  modified:
    - src/mcp/vice/text-monitor-live.test.ts
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/textmon-profile.ts
    - src/mcp/vice/textmon-profile.test.ts
    - src/mcp/vice/textmon-seam.test.ts
    - docs/phase42-text-format-drift-citations.md

key-decisions:
  - "The double-leading-prompt artifact on the first command after any halt-transition is drained with a warm-up dial in the TEST, not fixed in all five parsers -- narrower, well-precedented (matches this file's own first existing test), and does not touch production parsing code for a session-boundary transport nuance"
  - "prof flat needing prof on issued first is a real production gap (handleProfileFlat never toggles profiling), recorded honestly in the evidence doc and the cross-phase WINDOWS.md ledger as a deviation -- NOT fixed in this plan, since fixing it requires a design decision (should the tool auto-toggle profiling? classify the 'no data' state explicitly?) beyond this plan's declared scope"
  - "The ROOT pseudo-frame row IS fixed in this plan (textmon-profile.ts), because it blocks the format's own parsing correctness (PARSE-02/PARSE-03), not merely a wiring gap -- FlatProfileEntry.address widened to number | \"ROOT\", two new unit tests added"
  - "TEXT_COMMAND_ALLOWLIST widened by prof on/prof off is scoped to what the live suite needs to toggle, and restores state (prof off) before teardown, per this constant's own header comment inviting a 'conscious, deliberate' widening over a speculative one"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04]

coverage:
  - id: D1
    description: "Each of the five formats is parsed from a reply produced live by genuine stock VICE on this host, not only from a committed capture"
    requirement: "PARSE-01"
    verification:
      - kind: unit
        ref: "text-monitor-live.test.ts#plan 42-09 test case -- fail 0, zero skipped, all five formats asserted structurally decoded"
        status: pass
    human_judgment: false
  - id: D2
    description: "The capability probe returns a capable verdict for each of the five commands against the real stock binary, keyed on the binary's resolved absolute path"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-monitor-live.test.ts -- probeTextCapability() against all five commands, cacheKey === \"stock:/usr/bin/x64sc\" for every one"
        status: pass
    human_judgment: false
  - id: D3
    description: "The RAM-execute observation is recorded either way, with its denominator -- never smoothed over"
    requirement: "PARSE-01"
    verification:
      - kind: manual_procedural
        ref: "docs/phase42-text-format-drift-citations.md Block 13 -- 0 of 1565 entries, recorded as a shortfall naming what was searched"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live run is stock-only by construction, and the reason is recorded; the fork half of the two-binary requirement stays satisfied by the committed fork captures"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "docs/phase42-text-format-drift-citations.md Block 14 -- both binaries and versions named, the broker's stock-only launch-flag construction stated as the reason"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing is left running: the harness tears down its own broker and emulator, verified rather than assumed"
    requirement: "PARSE-01"
    verification:
      - kind: unit
        ref: "systemctl --user is-active vice-broker.service + ps -eo pid,cmd | grep x64sc, run before and after every live invocation -- inactive/0 both times, all four runs"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 09: All Five Text Formats Proven Live Against Genuine Stock VICE Summary

**All five text-monitor formats (memmapshow, chis, prof flat, bt, io) decode a reply dialed live from genuine stock `/usr/bin/x64sc` (VICE 3.9), the capability probe answers capable for all five and keys on the resolved absolute binary path, and this run surfaced two genuine live-only findings — a session-boundary prompt-doubling transport artifact and a real production gap in `vice_profile_flat` — recorded honestly rather than smoothed over, alongside a genuine parser-correctness fix (`textmon-profile.ts`'s ROOT pseudo-frame).**

## Performance

- **Duration:** ~55 min
- **Started:** ~2026-09-09T14:52:00Z (approx, first Read call)
- **Completed:** 2026-09-09T15:46:52Z
- **Tasks:** 2
- **Files modified:** 7 (6 in Task 1, 1 in Task 2)

## Accomplishments

- `text-monitor-live.test.ts` extended with one live case per format, all five dialed inside a single broker/emulator acquisition (one launch, not five): `memmapshow`/`bt` as bare frozen verbs, `chis`/`prof flat`/`io` dialed with `buildTextCommand()`'s own rendered output. Each dial is classified for build capability (`classifyTextCapabilityResponse`) before parsing, then handed to its owning `textmon-*.ts` parser with format-specific shape assertions (access-map entry count and RAM-execute count, CPU-history positive cycle counts, backtrace chain depth and current-PC frame, flat-profile row count and leading row, IO register's VIC-II section with its eight sprite columns).
- A capability case probes all five commands live and asserts every verdict `capable`, logging the real cache key `"stock:/usr/bin/x64sc"` for each — D-42-2's own property (the key names the resolved absolute path, never a bare name), observed live rather than only argued from unit tests.
- A RAM-execute observation case searched the full live access map (1565 entries) and found 0 RAM-execute entries — recorded in the evidence doc as a genuine shortfall with its denominator, never smoothed into a "found" outcome; criterion 1's RAM half stays covered by the declared-synthetic case only.
- `docs/phase42-text-format-drift-citations.md` gained a Live Evidence section: seven MEASURED blocks (one per format, one for the capability probe, one for the RAM-execute shortfall) plus a closing block naming both binaries/versions and stating the stock-only construction; the phase's two `42-VALIDATION.md` manual-only verifications are explicitly left standing.
- Live suite result: `tests 8, pass 8, fail 0, skipped 0`; teardown verified (no active broker unit, zero `x64sc` processes) before and after every one of four live invocations during this plan's own iteration.

## Task Commits

1. **Task 1: Five formats, live, against genuine stock VICE — parsed, not merely received** - `384ba984` (feat)
2. **Task 2: Record the live evidence, and close the phase's own verification sweep** - `9066e21b` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/text-monitor-live.test.ts` - one live case per format plus the capability/RAM-execute cases, sharing one harness acquisition; two warm-up dials draining the halt-transition prompt artifact
- `src/mcp/vice/text-protocol.ts` - `TEXT_COMMAND_ALLOWLIST` widened by `prof on`/`prof off` (a conscious, measured widening per this constant's own header comment)
- `src/mcp/vice/text-protocol.test.ts` - the allowlist's own pinned ten-verb equality test updated to match
- `src/mcp/vice/textmon-profile.ts` - `FlatProfileEntry.address` widened to `number | "ROOT"`; the row parser recognises the literal `"ROOT"` token
- `src/mcp/vice/textmon-profile.test.ts` - two new unit tests: a bare ROOT row, and a ROOT row alongside an ordinary hex-address row (order preserved)
- `src/mcp/vice/textmon-seam.test.ts` - `text-monitor-live.test.ts` declared as the sixth import-consumer for all five `textmon-*.ts` parsers
- `docs/phase42-text-format-drift-citations.md` - Live Evidence section (Blocks 7-14) appended

## Decisions Made

See `key-decisions` in frontmatter. The two decisions worth calling out in prose:

1. **The prompt-doubling artifact is drained in the test, not fixed in production.** MEASURED live and confirmed by direct diagnostic (dialing the same verb three times on one session: only the first carried the doubled prefix; the second and third did not) that the FIRST command issued after ANY halt-transition — cold boot, or a resume-then-halt via the binary channel — carries an extra leading `(C:$xxxx)` prompt merged into the reply. Every production text-tool handler (`text-tools.ts`) does exactly one `textConnect()`+`command()`+`textDisconnect()` per call, so a call that happens to be the FIRST command against a freshly launched instance is genuinely affected in production too — but fixing this properly (loosening every parser's leading-prompt handling, or draining a passive banner transport-side) is a cross-cutting change this plan's declared scope (test + doc only) does not cover. The test drains it with one harmless warm-up dial, matching this file's own first existing test's own established shape.
2. **prof flat's need for `prof on` is recorded, not fixed.** MEASURED live that VICE's own profiler defaults off and `prof flat` alone returns `"No profiling data available..."` on a fresh instance; no handler in this tree issues `prof on` today, so `vice_profile_flat` cannot yet produce real data in production. Fixing this requires a design decision (auto-toggle profiling inside the handler? explicitly classify the "no data" state?) this plan does not make unilaterally — recorded as a deviation in the evidence doc and the cross-phase `WINDOWS.md` ledger for a future plan to close deliberately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The first command after a halt-transition on a freshly cold-launched instance carries an extra leading prompt, blocking memmapshow's parse**

- **Found during:** Task 1, first live run — `memmapshow`, dialed as the very first command on a fresh session, failed to parse (`missing-header`, the raw reply carried TWO leading `(C:$xxxx)` prompts, and the parser strips exactly one).
- **Issue:** A genuinely new live fact, not present in any committed fixture: VICE announces a halt with its own unsolicited prompt line before the next command's real output, merged into the same framed reply. This happens on the FIRST command after connect (a one-time monitor-activation event) AND, separately, on the first command after any binary-channel resume-then-halt cycle.
- **Fix:** Two warm-up dials added to the live test — one `device c:` before the five-format sequence (draining the connect-time activation banner), one more after the deliberate `vice_execution_run`/resume before dialing `prof flat` (draining the resume-then-halt banner). Neither touches production parsing code.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** Live suite re-run after each fix; final run `tests 8, pass 8, fail 0`.
- **Committed in:** `384ba984` (Task 1 commit)

**2. [Rule 3 - Blocking] `prof flat` alone returns "No profiling data available" on a fresh instance -- profiling is off by default**

- **Found during:** Task 1, live run — after fixing the prompt-doubling artifact, `prof flat` still refused to parse (`missing-header`, first line was VICE's own "No profiling data available. Start profiling with \"prof on\"." message).
- **Issue:** VICE's flat profiler defaults off. `prof on` was not in `TEXT_COMMAND_ALLOWLIST`, so the live test could not toggle it.
- **Fix:** `TEXT_COMMAND_ALLOWLIST` widened by `prof on`/`prof off` (`text-protocol.ts`) — a conscious, measured widening per D-01's own header comment. The live test toggles profiling on, resumes the CPU briefly through the binary channel (via `dispatchStock("vice_execution_run", ...)`) so the profiler has genuine cycles to attribute, dials `prof flat`, then toggles it off again. `text-protocol.test.ts`'s own pinned allowlist-equality test updated from eight to ten verbs.
- **Files modified:** `src/mcp/vice/text-protocol.ts`, `src/mcp/vice/text-protocol.test.ts`, `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** `node --test text-protocol.test.ts` (all pass); live suite re-run, `prof on` succeeded ("Profiling restarted.").
- **Committed in:** `384ba984` (Task 1 commit)

**3. [Rule 1 - Bug] `textmon-profile.ts` refused a genuine live `prof flat` reply carrying VICE's own "ROOT" pseudo-frame row**

- **Found during:** Task 1, live run — after enabling profiling, `prof flat`'s live reply contained a row whose address field was the literal text `ROOT` (VICE's own synthetic top-level pseudo-frame, attributing cycles that elapsed outside any traced call), and the parser refused (`malformed-row`, expecting four hex digits).
- **Issue:** Neither committed fixture happened to capture this row shape (both ran long enough that no cycles landed at the root) — a genuine parser-correctness gap this live run surfaced, exactly what PARSE-02/PARSE-03's "the fixtures prove the shape; only a live run proves the wiring" is designed to catch.
- **Fix:** `FlatProfileEntry.address` widened from `number` to `number | "ROOT"`; the row parser recognises the literal `"ROOT"` token (exact, case-sensitive) before the hex-digit shape check. Two new unit tests cover a bare ROOT row and a ROOT row alongside an ordinary hex-address row, both asserting VICE's own emitted order is preserved.
- **Files modified:** `src/mcp/vice/textmon-profile.ts`, `src/mcp/vice/textmon-profile.test.ts`
- **Verification:** `node --test textmon-profile.test.ts` — 21/21 pass; live suite re-run, `prof flat` parsed 3 rows including the leading `ROOT` row.
- **Committed in:** `384ba984` (Task 1 commit)

**4. [Rule 3 - Blocking] `textmon-seam.test.ts`'s declared import-consumer sets for all five formats went red once the live test genuinely imported all five parsers**

- **Found during:** Task 1, running the full automated gate after the live test change — `textmon-seam.test.ts` (not named in this plan's `read_first` list, since the plan's own author could not have anticipated a structural test in a sibling plan's own file) failed five "measured import-consumer set equals the declared set" assertions, all naming `text-monitor-live.test.ts` as an undeclared importer.
- **Issue:** This plan's own action explicitly required calling each owning parser directly on a live reply (`parseAccessMap()`, `parseCpuHistory()`, etc.) — a genuine, intended new import relationship the structural guard correctly caught rather than silently absorbed.
- **Fix:** `text-monitor-live.test.ts` added to `importConsumers` for all five `FORMAT_OWNERS` entries in `textmon-seam.test.ts`, each with its own stated reason naming plan 42-09. (A follow-up self-correction: the first wording used the call-shaped token `parseAccessMap()` etc. inside the reason string, which tripped this same file's own "never call a parser function" scope-boundary self-check — reworded to avoid the literal `name(` shape.)
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` — 33/33 pass.
- **Committed in:** `384ba984` (Task 1 commit)

**5. [Rule 3 - Blocking] `node_modules/` was empty in this worktree**

- **Found during:** Task 1, first `npm run test:automated` baseline measurement — `tsc` binary missing, `ENOENT`.
- **Issue:** This worktree's `node_modules/` was never provisioned (the `SessionStart` hook that normally runs `npm ci` had not fired for this worktree).
- **Fix:** `npm ci` run directly in `src/mcp/vice` — the project's own committed-lockfile dependency install, not an external tool install (CLAUDE.md's standing constraint on external tools does not apply to the package's own npm dependencies).
- **Files modified:** none (generated `node_modules/`, gitignored)
- **Verification:** `npm run test:automated` ran cleanly afterward.
- **Committed in:** n/a (gitignored, nothing to commit)

---

**Total deviations:** 5 auto-fixed (3 Rule 3/blocking, 1 Rule 1/bug, 1 Rule 3/blocking-tooling). **Impact:** two are recorded findings rather than fixes (the prompt-doubling artifact drained test-side; the `prof flat`/`prof on` production gap recorded in `WINDOWS.md` for future closure) — no scope creep into fixing production tool-handler behavior beyond what was needed to prove the live path. The ROOT pseudo-frame fix is a genuine, narrowly-scoped parser-correctness fix squarely within PARSE-02/03's own charter. No acceptance criterion weakened.

## Issues Encountered

**`vice_profile_flat` cannot yet produce real data in production** (recorded in `docs/phase42-text-format-drift-citations.md` Block 9 and in `.planning/WINDOWS.md` as an open deviation): `handleProfileFlat` (`text-tools.ts`) dials `prof flat` alone, with no `prof on` toggle. This is real, separately-tracked, and not this plan's own scope to close.

## Measured Automated-Gate Baseline (plan's own requirement)

Measured at plan start (after provisioning `node_modules/`, `npm ci`):
`cd src/mcp/vice && npm run test:automated` — **exit 1, 8 failures**, matching plan 42-07's own recorded worktree baseline byte-for-byte:
- `anno-import.test.ts` (1 failure, documented floor)
- `anno-register.test.ts` (2 failures, documented floor)
- `dxa-seam.test.ts` (4 failures — vendored `dxa` binary not built in this worktree)
- `repo-root.test.ts` (1 failure — this worktree's path sits under `.claude/worktrees/agent-.../`, tripping a "not under .claude" assertion)

Measured again after both task commits: **exit 1, same 8 failures, same 4 files** — no new failing file, no failure count exceeding the baseline. (One intermediate run also showed `audit-root-args.test.ts` failing once; re-run in isolation passed 58/58 — the project's own documented intermittent scratch-file race, not a regression from this plan's changes.)

## Live Run — Measured Values (plan's own requirement)

All against `stock:/usr/bin/x64sc` (`x64sc (VICE 3.9)`), 2026-09-09:

| Format | Command dialed | Measured result |
|---|---|---|
| memmapshow | `memmapshow` | 1565 entries |
| chis | `chis 20` | 20 entries, cycle range 39245-39309 |
| prof flat | `prof flat 20` (after `prof on`) | 3 rows; leading row `{totalCycles:530709, totalPercent:100, selfCycles:530709, selfPercent:100, address:64848}` |
| bt | `bt` | chain depth 2, currentPc 0xfd7c |
| io | `io $d020` | chip VIC-II, rasterLine 311, borderColor 0x0 |

**Capability probe cache key** (verbatim, all five commands): `"stock:/usr/bin/x64sc"`.

**RAM-execute outcome:** 0 of 1565 entries — recorded as a shortfall, not smoothed over.

**Teardown verification result:** `systemctl --user is-active vice-broker.service` → `inactive`; `ps -eo pid,cmd | grep x64sc` → 0 processes. Confirmed before and after all four live-suite invocations run during this plan's own iteration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All nine of this phase's touched test files are green (`textmon-seam.test.ts`, five `textmon-*.test.ts`, `text-capability-probe.test.ts`, `text-protocol.test.ts`, `text-tools.test.ts`) — 246 tests, 0 failures.
- The phase's own citation record (`docs/phase42-text-format-drift-citations.md`) now carries this phase's complete evidence: source-traced drift corrections (plan 42-06) plus live-measured proof of the wiring (this plan), with both remaining manual-only bounds explicitly stated rather than implied closed.
- Two items are left for a future plan, both named rather than silent: `vice_profile_flat`'s missing `prof on` toggle (recorded in `WINDOWS.md`), and the two `42-VALIDATION.md` manual-only verifications (no genuinely disabled-cpuhistory build on this host; `io`'s two degradation strings not live-observed).
- No blockers for phase completion — this is the last plan in phase 42's wave 4.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-09-SUMMARY.md`
- FOUND commit: `384ba984` (Task 1)
- FOUND commit: `9066e21b` (Task 2)
- FOUND: `src/mcp/vice/text-monitor-live.test.ts`, `src/mcp/vice/text-protocol.ts`, `src/mcp/vice/textmon-profile.ts`, `src/mcp/vice/textmon-seam.test.ts`, `docs/phase42-text-format-drift-citations.md`
- Re-ran all `<acceptance_criteria>` across both tasks: PASS
- Re-ran the plan-level `<verification>` block (teardown checks before/after; `node --test text-monitor-live.test.ts` 8/8 pass, 0 skipped; the phase's own nine-file unit sweep 246/246 pass; `npm run typecheck` clean; `npm run test:automated` at the documented 8-failure worktree baseline, no new failing file): PASS
