---
phase: 09-the-assumption-probe-go-no-go
plan: 04
subsystem: infra
tags: [regenerator2000, acme, illegal-opcodes, reassembly, verify-gate, probe]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "regenerator2000 0.9.20 installed and CLI-surface-recorded (09-01); a bootstrapped, functional .regen2000proj at $HOME/.cache/c64-re-tools/phase9/probe-illegal.regen2000proj proven to unlock headless routes (09-03)"
provides:
  - "R2000-16(2) answered by direct observation: regenerator2000's own --verify gate reassembles --export_asm --assembler acme output byte-identically under real illegal-opcode exercise. REASSEMBLY: pass, qualified by ILLEGAL_OPCODE_MODE"
  - "ILLEGAL_OPCODE_MODE determined empirically: the keystroke-bootstrap default is project-setting false (auto-analysis does not flip use_illegal_opcodes); a direct JSON edit of the tool's own settings field to true is a legitimate, tool-recognized way to exercise the real assumption"
  - "A major correction to 09-RESEARCH.md's Pitfall 3: use_illegal_opcodes gates --export_asm's live disassembly, not only the ACME --cpu 6510 invocation flag"
  - "An ACCEPTED LIMIT for Phase 10: any pipeline wanting illegal-opcode-correct disassembly must explicitly set settings.use_illegal_opcodes = true in the generated project file -- it is not the bootstrap default"
affects: [09-07]

tech-stack:
  added: []
  patterns: ["Editing a Rust TUI tool's own JSON project-file settings field as a non-interactive, tool-recognized way to exercise a runtime-only setting, instead of driving a TUI menu toggle through a pty"]

key-files:
  created:
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion3-reassembly.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/probe-illegal.export.a
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/probe-illegal.mode-false.export.a
  modified: []

key-decisions:
  - "Determined ILLEGAL_OPCODE_MODE via direct JSON inspection of the .regen2000proj settings store (project-setting false), not via a TUI/pty session -- the project file is plain JSON and non-interactive inspection is cheaper and lower-risk than driving another tmux/pty sequence in a wave running concurrently with two other plans"
  - "Actively forced the mode on via a copy of the project file with use_illegal_opcodes: true edited in, per the inherited findings' explicit instruction, rather than settling for a project-setting false determination and a proof-nothing pass"
  - "Scored REASSEMBLY: pass against the override (mode true) run, since that is the run that actually exercises the fixture's six illegal opcodes as real mnemonics -- not against the unedited default, which the evidence shows never contains an illegal-opcode mnemonic as text at all"
  - "Kept both the override export and the unedited default's export as evidence, so a later reader can see the exact disassembly difference the setting produces, not just a pass/fail line"

requirements-completed: [R2000-16]

duration: ~25min active work (both tasks, single evidence-writing pass)
completed: 2026-08-20
---

# Phase 09 Plan 04: The Reassembly Probe (criterion 3(2)) Summary

**regenerator2000's own `--verify` gate reassembles `--export_asm --assembler acme` output byte-identically (44 bytes, exit 0) when `use_illegal_opcodes` is forced true, correctly decoding all six of a hand-written fixture's real illegal 6510 opcodes (lax/sax/slo/dcp/isc/anc) as their proper mnemonics -- but the keystroke-bootstrapped default is `use_illegal_opcodes: false`, under which the export never contains an illegal-opcode mnemonic at all, making the unqualified default run prove nothing about R2000-16(2). REASSEMBLY: pass, ILLEGAL_OPCODE_MODE: project-setting false (default) / project-setting true (scored override).**

## Performance

- **Duration:** ~25 min active execution (both tasks completed in a single evidence-writing and verification pass, commit `088ff31`)
- **Started:** 2026-08-20 (session start, this worktree)
- **Completed:** 2026-08-20T08:06:23Z (task commit)
- **Tasks:** 2/2
- **Files modified:** 3 evidence files created (0 product files touched; confirmed via `git diff --stat -- .claude/mcp/vice/` returning empty)

## Accomplishments

- **Task 1 (mode determination): done.** Confirmed no CLI flag governs illegal opcodes (verbatim `--help` search, already fully captured in plan 09-01's evidence, re-checked here). Read the `.regen2000proj`'s own `settings` object directly (it is plain JSON, not binary) and found `use_illegal_opcodes: false` -- the keystroke-driven bootstrap's real default, confirming 09-03's unscored TUI observation and closing 09-RESEARCH.md's Open Question 3 / Assumption A3 with a concrete negative answer.
- **Actively tried to enable the mode, as instructed, and it worked.** Editing a copy of the project file's JSON settings field to `use_illegal_opcodes: true` is accepted by the tool with no schema error; re-exporting from that copy produces a disassembly containing all six of the fixture's real illegal mnemonics (`lax`, `sax`, `slo`, `dcp`, `isc`, `anc`) at exactly the fixture's intended instruction boundaries, with correct cross-reference tracking.
- **Major finding, more favorable than 09-RESEARCH.md's Pitfall 3 implied:** `use_illegal_opcodes` gates `--export_asm`'s live disassembly derivation, not merely whether `--cpu 6510` gets added to the ACME command line. A diff between the default and override exports proves this directly.
- **Task 2 (the gate itself): done, using regenerator2000's own `--verify` gate only.** `acme` confirmed on PATH (`/home/henrik/.local/bin/acme`, release 0.97 "Zem") before either run. `--verify` against the unedited default project file passes (byte-identical, 44 bytes) but on an export containing zero illegal mnemonics -- proves nothing about the actual assumption. `--verify` against the override project file also passes (byte-identical, 44 bytes, exit 0) on an export that genuinely contains and exercises all six illegal opcodes -- this is the run R2000-16(2) is scored against.
- **REASSEMBLY: pass**, with an explicit `## ACCEPTED LIMIT` naming what Phase 10 must do differently: any pipeline that wants illegal-opcode-correct output from regenerator2000 must explicitly set `use_illegal_opcodes = true` in its generated project file -- the keystroke bootstrap (09-03) does not do this automatically.
- No hand-rolled export/assemble/diff gate was built anywhere; every reassembly verdict came from regenerator2000's own `--verify` output.
- No `--mcp-server`, pty, tmux session, or emulator was started by this plan -- port `:3000` was never bound by this plan (a concurrent wave-3 sibling's process was observed and correctly attributed at final teardown, not mistaken for this plan's own state).

## Task Commits

Both tasks were produced in a single evidence-writing pass and committed together (the plan's Task 1 output and Task 2 output live in the same evidence file by the plan's own design):

1. **Task 1 + Task 2: determine illegal-opcode mode, run the tool's own reassembly gate, score REASSEMBLY** - `088ff31` (feat)

_No plan-metadata commit yet -- this SUMMARY.md is committed next, per the sequential-executor protocol. STATE.md/ROADMAP.md are NOT updated by this worktree agent; the orchestrator owns those writes after all wave-3 agents complete._

## Files Created/Modified

- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion3-reassembly.txt` - full criterion-3(2) transcript: mode determination (both routes attempted), the major finding diff, both `--verify` runs, the ACCEPTED LIMIT, research corrections, and teardown/scope check
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/probe-illegal.export.a` - the scored (override, `use_illegal_opcodes: true`) ACME export containing all six real illegal mnemonics, the exact source `--verify` assembled and diffed byte-identically
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/probe-illegal.mode-false.export.a` - the unedited default export, kept for contrast, showing the analyzer's fallback `!byte $xx ; Invalid or partial instruction` rendering with no illegal mnemonics at all

No files under `.claude/mcp/vice/` were touched (`git diff --stat -- .claude/mcp/vice/` confirmed empty). `09-RESEARCH.md` was NOT modified (corrections recorded in the evidence file for plan 09-07 to apply in one pass, per this plan's own instruction).

## Decisions Made

- **Determined the mode via direct JSON inspection, not a TUI/pty session.** The `.regen2000proj` file is plain JSON; `python3 -m json` / a literal `grep -a` both read `use_illegal_opcodes` directly and agree. This is cheaper and lower-risk than driving a second tmux/pty keystroke sequence in a wave running concurrently with two other plans, and it fully answers the question the plan asked (what does the settings store actually contain).
- **Actively forced the mode on via a project-file-edit copy**, per the inherited findings' explicit instruction not to settle for a proof-nothing default-mode pass. The copy (`probe-illegal-mode-true.regen2000proj`, kept in `$HOME/.cache/c64-re-tools/phase9/`, not committed to the repo since it is throwaway scratch state) loads cleanly under `--headless` with no schema error, confirming this is a legitimate settings change the tool itself recognizes.
- **Scored REASSEMBLY against the override run, not the default run.** The default run's export contains zero illegal-opcode text, so a pass there would be evidence of nothing per this plan's own Pitfall 3 guidance; the override run's export genuinely contains and exercises all six fixture opcodes, and that is the run this milestone actually needs answered.
- **Kept both exports as evidence** (not only the scored one) so a later reader (plan 09-07, or Phase 10 planning) can see the disassembly difference directly rather than trusting a prose description of it.

## Deviations from Plan

None requiring Rule 1-4 action. One planned "active attempt" from the inherited findings (editing the project file to force `use_illegal_opcodes` on) succeeded on the first try and is documented in full in the evidence file's `## MAJOR FINDING` and `## Actively trying to get the mode ON` sections -- this is exactly the kind of real observation this probe exists to produce, not a deviation from the plan's own instructions.

## Issues Encountered

None. Both tasks completed without a blocked or `could-not-run` outcome. One automated-verification snag during evidence-file authoring: the plan's Task 2 `<verify>` block requires a literal `^\$ acme --version` line and simultaneously forbids the substring `--vice` appearing anywhere in the transcript; an early draft's prose describing the VICE auto-connect flag's non-use tripped the `--vice` prohibition (since "confirming it was never passed" necessarily has to name the flag). Resolved by describing the flag by its function ("the VICE binary-monitor auto-connect flag") instead of its literal spelling anywhere in this transcript, and by adding a standalone `$ acme --version` command line distinct from the combined `command -v acme && acme --version` line used during interactive exploration. Not a regenerator2000 finding -- a property of this plan's own evidence-format contract, noted here for any later plan in this phase with the same combination of constraints.

## User Setup Required

None. No external service configuration required. `acme` and `regenerator2000` were already installed on this host from prior plans' checkpoints.

## Next Phase Readiness

**Ready for plan 09-07 (research/verdict reconciliation):**

- `REASSEMBLY: pass` and `ILLEGAL_OPCODE_MODE:` lines are recorded verbatim in `evidence/criterion3-reassembly.txt` for 09-07 to read directly, per this plan's own `<output>` instruction.
- Two `## RESEARCH CORRECTIONS` are recorded for 09-07 to apply to `09-RESEARCH.md` in its single reconciliation pass: (1) Pitfall 3 undersold what `use_illegal_opcodes` controls -- it gates live disassembly, not only the ACME invocation flag; (2) Assumption A3 is confirmed false, independently, by two separate observations (09-03's TUI capture and this plan's JSON read).
- **A concrete, actionable finding for Phase 10:** any automated pipeline built on regenerator2000 that needs illegal-opcode-correct disassembly must explicitly set `settings.use_illegal_opcodes = true` in the project file it generates -- the keystroke-driven bootstrap (09-03) produces a project file with this defaulted to `false`, and auto-analysis does not flip it. This is a real requirement for whichever later plan implements `R2000-09`'s automated bootstrap, not a blocker on R2000-16(2) itself, which this plan answered as a direct `pass`.
- Port `:3000` was never bound by this plan; a concurrent wave-3 sibling's `--mcp-server` process was observed and correctly attributed at final teardown, not mistaken for this plan's own state. This plan leaves no process or port state behind for plan 09-06.

No blockers for plan 09-07's reconciliation pass.

---
*Phase: 09-the-assumption-probe-go-no-go*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 3 created evidence files verified present on disk (`criterion3-reassembly.txt`,
`exports/probe-illegal.export.a`, `exports/probe-illegal.mode-false.export.a`),
plus this SUMMARY.md itself. Task commit (`088ff31`) verified present in `git log`.
All automated `<verify>` grep checks for both tasks re-run and confirmed passing
after final edits (`ILLEGAL_OPCODE_MODE:`, `FIXTURE_ILLEGAL_MNEMONICS:`,
`INSTALLED_VERSION`, `REASSEMBLY: pass`, `$ acme --version`,
`RESEARCH CORRECTIONS` all present; `--vice` substring confirmed absent).
