---
phase: 13-external-verification
plan: 03
subsystem: testing
tags: [vice, binary-monitor, probe, autostart, joyport, advance-instructions, remotemonitor, fork-vice]

# Dependency graph
requires:
  - phase: 13-external-verification (plan 01/02, same phase)
    provides: re-recorded binmon fixtures and --help backend discriminator evidence, same probe script family
provides:
  - "--probe-assumptions mode in probe-binmon.mjs with live verdicts for A1, A2, A3, A5"
  - "13-PROBE-RESULTS.md: one CONFIRMED/CONTRADICTED/INCONCLUSIVE verdict per assumption, raw observations, folded-todo step answers"
  - "an advertised-tool-contract finding for vice_disk_attach handed to plan 13-05 (D-13-04 escape hatch)"
affects: [13-04 (label-removal decisions consume this plan's verdicts), 13-05 (files the vice_disk_attach contract-correction todo)]

# Actuals (#2632)
actuals:
  tokens: 42000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Wire-shape gate before behavioural claim: every live probe checks the reply error code is not INVALID_LENGTH/INVALID_PARAMETER/INVALID_TYPE before trusting any behavioural observation built on it"
    - "PING-to-halt for register writes: any inbound byte halts the emulator (docs/phase0-binmon-findings.md §4); used instead of a checkpoint to get a reliable halt before REGISTERS_SET"
    - "itemSize+1 wire stride for REGISTER_INFO/REGISTERS_AVAILABLE parsers, proven by a selftest case whose second item's itemSize exceeds its content minimum"

key-files:
  created:
    - .planning/phases/13-external-verification/13-PROBE-RESULTS.md
  modified:
    - .claude/mcp/vice/probe-binmon.mjs

key-decisions:
  - "Ran probes only against the dynamically resolved first-in-PATH binary (fork:/usr/local/bin/x64sc, 3.10), per the plan's own instruction — did not also probe genuine stock 3.9, and the results document names that scope explicitly rather than implying broader coverage"
  - "A3's null result (no CIA1 port delta on any single-bit JOYPORT_SET) recorded as INCONCLUSIVE rather than forced toward CONFIRMED or CONTRADICTED — no evidence either way"
  - "A5's CONTRADICTED verdict surfaced as a genuine advertised-tool-contract finding (vice_disk_attach's D-14 'attach without loading or running' claim is refuted) rather than silently absorbed into the assumption-only framing; handed to plan 13-05 per D-13-04's escape hatch, not redesigned in this plan"

requirements-completed: [EXTV-03]

coverage:
  - id: D1
    description: "probe-binmon.mjs gains a --probe-assumptions mode covering A1/A2/A3/A5, with every new body builder/parser covered by the offline --selftest"
    requirement: EXTV-03
    verification:
      - kind: other
        ref: "cd .claude/mcp/vice && node probe-binmon.mjs --selftest"
        status: pass
      - kind: other
        ref: "cd .claude/mcp/vice && node --test binmon-fixtures.test.ts"
        status: pass
      - kind: other
        ref: "cd .claude/mcp/vice && npm run test:automated"
        status: pass
    human_judgment: false
  - id: D2
    description: "13-PROBE-RESULTS.md records exactly one verdict per assumption (A1/A2/A3/A5) with raw observations, resolved binary/version, ss -ltnp corroboration, folded-todo step answers, A4 non-run record, and a Consequences-for-13-04 section"
    requirement: EXTV-03
    verification:
      - kind: other
        ref: "node -e checking 4 verdict tokens, A1/A2/A3/A5 sections, 'Consequences for plan 13-04', 'ss -ltnp' present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live probe verdicts themselves (A1 CONFIRMED, A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED) reflect the emulator's real behaviour, not a probe defect"
    human_judgment: true
    rationale: "Whether the probe's interpretation of the raw bytes/log lines is correct (e.g. that the PC landing at JSR+3 really means step-over worked, or that the emulator log's RESET/Loading lines really mean the disk-attach approximation is broken) is a judgment call about C64/VICE semantics that a human familiar with the platform should confirm before plan 13-04 acts on it."

duration: 25min
completed: 2026-08-22
status: complete
---

# Phase 13 Plan 03: Phase 3 Assumption Probes Summary

**Live-probed all four outstanding Phase 3 wire assumptions against fork VICE 3.10 — confirmed the step-over and remote-monitor-binding assumptions, found the joystick-bit-mapping probe inconclusive, and refuted the AUTOSTART disk-attach approximation (it resets the machine and loads a program despite the run flag being clear).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-21T23:35:00Z (approx.)
- **Completed:** 2026-08-21T23:59:44Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added `REGISTERS_GET`/`REGISTERS_SET`/`JOYPORT_SET`/`AUTOSTART` opcodes plus seven new body builders/parsers to `probe-binmon.mjs`, each independent of `stock-protocol.ts` and covered by the script's offline `--selftest`, including a wire-stride case proving `itemSize+1` framing rather than a fixed stride.
- Implemented four live probes (`probeA1RemoteMonitorPort`, `probeA2StepOver`, `probeA3JoyportBits`, `probeA5AutostartFileIndex`) behind a new `--probe-assumptions` mode, each gated on wire-shape acceptance before its behavioural half, each cleaning up in a `finally`, and none arming any checkpoint (A4 stays explicitly out of scope).
- Ran the probes twice against the dynamically resolved binary (`fork:/usr/local/bin/x64sc`, VICE 3.10.0.0) and recorded reproducible verdicts in `13-PROBE-RESULTS.md`: **A1 CONFIRMED**, **A2 CONFIRMED**, **A3 INCONCLUSIVE**, **A5 CONTRADICTED** — with the A5 contradiction surfaced as a genuine advertised-tool-contract finding for `vice_disk_attach`, handed to plan 13-05.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add opcodes, body builders and reply parsers with offline selftest coverage** - `76ab21b` (feat)
2. **Task 2: Implement the four probes (A1 port binding, A2 step-over PC, A3 joystick bits, A5 autostart fileIndex)** - `d60f54f` (feat)
3. **Task 3: Run the probes live and record 13-PROBE-RESULTS.md** - `1a56c93` (docs)

## Files Created/Modified
- `.claude/mcp/vice/probe-binmon.mjs` - added `REGISTERS_GET`/`REGISTERS_SET`/`JOYPORT_SET`/`AUTOSTART` opcodes, `advanceInstructionsBody`/`registersGetBody`/`registersSetBody`/`joyportSetBody`/`autostartBody` builders, `parseRegisterInfo`/`parseRegistersAvailable` parsers, and the `--probe-assumptions` mode (`runAssumptionProbes` + four probe functions), all offline-selftest-covered
- `.planning/phases/13-external-verification/13-PROBE-RESULTS.md` - new: resolved-binary header, per-assumption sections with raw wire/behavioural observations, folded-todo step answers 1-5, A4 non-run record, and the `Consequences for plan 13-04` table

## Decisions Made
- Probed only the dynamically resolved first-in-PATH binary (the fork, 3.10) per the plan's own instruction; the results document names this scope explicitly and flags where a verdict's mechanism could plausibly be version- or fork-vs-stock-sensitive, rather than implying stock-3.9 coverage that was never obtained.
- Recorded A3 as INCONCLUSIVE rather than forcing a CONFIRMED/CONTRADICTED call — two independent live sessions produced an identical null result (no observable CIA1 port delta on any single-bit `JOYPORT_SET`), which is genuinely unresolved evidence, not a disguised failure.
- Treated A5's contradiction as also being an advertised-tool-contract problem (not just an internal assumption problem): `vice_disk_attach`'s documented approximation promises "attach without loading or running", and the live evidence (sentinel destruction, emulator's own `RESET`/`Loading program '*'` log lines, byte-level corroboration) shows that promise is false on this build. Recorded and handed to plan 13-05 per D-13-04's escape hatch rather than redesigned here.

## Deviations from Plan

None - plan executed exactly as written. The plan's own escape-hatch clause (D-13-04, "if a probe shows an advertised tool contract is wrong, record the finding and stop") was exercised for A5 exactly as specified, not as a deviation from the plan.

## Issues Encountered
- A single `npm test` run showed one transient failure (`fail 1`) in an unrelated live-emulator-adjacent suite; an immediate re-run of the full `npm test` suite showed `fail 0`. Not reproducible, and no file this plan touched is implicated — recorded here for transparency rather than silently ignored. `npm run test:automated` (the narrower, non-flaky gate this plan's acceptance criteria actually key off) was green on every run.
- The emulator's condensed log only showed one explicit `AUTOSTART: Resetting the machine to autostart '*'` line per session, associated with the `fileIndex=0` call; the second call (`fileIndex=1`, same already-attached image) returned `OK` on the wire but produced no second logged reset/load sequence at this log verbosity. Recorded as an open, unresolved detail in `13-PROBE-RESULTS.md` rather than resolved by inference — it does not change the A5 verdict (the sentinel was destroyed and the machine reset at least once despite `runAfter=false`), but the exact mechanics of the second call are not established.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 13-04 has everything it needs to act on A1/A2/A3/A5: `13-PROBE-RESULTS.md`'s `Consequences for plan 13-04` table names, per assumption, whether the `[ASSUMED]` label may come off (A1, A2), must stay on (A3, A5), or needs a correction-plus-regression-test (A5).
- Plan 13-05 has a concrete, evidenced todo waiting: `vice_disk_attach`'s D-14 approximation is refuted, not merely unconfirmed — a full machine reset and program load occur despite the run flag being clear.
- The folded todo (`2026-08-14-probe-phase3-assumed-wire-details.md`) is not yet closed: A1/A2/A3/A5 are answered, but A4 (the non-stopping-checkpoint rate-limiter timing under a real flood) remains its one open item by design (D-13-05).

---
*Phase: 13-external-verification*
*Completed: 2026-08-22*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/probe-binmon.mjs`
- FOUND: `.planning/phases/13-external-verification/13-PROBE-RESULTS.md`
- FOUND commit: `76ab21b` (Task 1)
- FOUND commit: `d60f54f` (Task 2)
- FOUND commit: `1a56c93` (Task 3)
- Re-ran plan-level verification: `node probe-binmon.mjs --selftest` exits 0; `node -e 'import(...)'` prints `import clean`; `npx tsc --noEmit` clean; `npm run test:automated` 2079/2084 pass (5 pre-existing todo, 0 fail); `13-PROBE-RESULTS.md` carries exactly 4 canonical `**Verdict: A{1,2,3,5} — ...**` lines plus a `Consequences for plan 13-04` section and an `ss -ltnp` corroboration block.
