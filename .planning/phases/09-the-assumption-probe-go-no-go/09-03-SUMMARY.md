---
phase: 09-the-assumption-probe-go-no-go
plan: 03
subsystem: infra
tags: [regenerator2000, tmux, pty, mcp, streamable-http, keystroke-injection, probe]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "regenerator2000 0.9.20 installed and CLI-surface-recorded (09-01), including the confirmed --mcp-server / --headless flag spellings this plan used verbatim"
provides:
  - "R2000-16(1) answered by direct observation: HTTP MCP mode tolerates a pty with no real TTY (2a pass) and the project-file bootstrap is fully automatable with no human via tmux keystroke injection (2b pass)"
  - "A bootstrapped .regen2000proj file at $HOME/.cache/c64-re-tools/phase9/probe-illegal.regen2000proj, proven to unlock headless routes by a fresh --headless invocation -- consumed by wave 3's three plans"
  - "A reusable, throwaway MCP Streamable-HTTP harness (evidence/mcp-harness.mjs) resolved against the vendored SDK with no npm install"
  - "Closed 09-RESEARCH.md Open Questions 1 and 2 (project_path populated post-bootstrap; Save-As default filename is <stem>.regen2000proj) and Assumption A1 (M-s registers as Alt+S on first attempt, no fallback encoding needed)"
  - "A research correction: an unanticipated 'Import Context Setup' confirmation modal appears between file load and auto_analyze() completion, not shown in 09-RESEARCH.md's data-flow diagram"
affects: [09-04, 09-05, 09-06, 09-07, 09-08]

tech-stack:
  added: []
  patterns: ["tmux send-keys/capture-pane keystroke-injection driving a real crossterm TUI under a pty", "StreamableHTTPClientTransport against a live third-party MCP HTTP server, resolved from a worktree via a node_modules symlink into the main checkout"]

key-files:
  created:
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pty-transcript.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-initial.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-after-alt-s.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-after-enter.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs
  modified: []

key-decisions:
  - "Took the tmux route (not the Python pty fallback) per the inherited findings -- tmux 3.5a was confirmed on PATH, giving real terminal emulation instead of a raw escape-sequence byte stream"
  - "Did not create evidence/pty-driver.py -- tmux was available, so the fallback was never needed, matching the inherited-findings instruction exactly"
  - "Dismissed an unplanned 'Import Context Setup' modal via Enter before attempting Alt+S, since it held focus and would otherwise block the Save-As sequence -- recorded as a research correction rather than a deviation from this plan's own task list"
  - "Scored 2a (PTY_TOLERANCE) and 2b (BOOTSTRAP_AUTOMATABLE) as two separate, sequential outcome lines per the plan's explicit scoring discipline; both passed"

requirements-completed: [R2000-16]

duration: ~20min active work (tasks 1-3, from first task commit to last)
completed: 2026-08-20
---

# Phase 09 Plan 03: The pty + Keystroke Bootstrap Probe (criterion 2) Summary

**Both sub-checks of R2000-16(1) passed by direct observation: regenerator2000's HTTP MCP mode tolerates a pty with no real TTY, and the .regen2000proj Save-As bootstrap is fully automatable with zero human keystrokes via tmux -- PTY_TOLERANCE: pass, MCP_SERVED: pass, BOOTSTRAP_AUTOMATABLE: pass, PROJECT_FILE: /home/henrik/.cache/c64-re-tools/phase9/probe-illegal.regen2000proj.**

## Performance

- **Duration:** ~20 min of active execution across three tasks (commit timestamps 07:25:29Z-07:34:14Z UTC, 2026-08-20), plus setup/context-reading time
- **Started:** 2026-08-20T07:25:29Z (first task commit)
- **Completed:** 2026-08-20T07:34:14Z (last task commit)
- **Tasks:** 3/3
- **Files modified:** 5 evidence files created (0 product files touched; confirmed via `git diff --stat -- .claude/mcp/vice/` returning empty at every step)

## Accomplishments

- **2a (pty tolerance): PASS.** `regenerator2000 --mcp-server probe-illegal.prg` launched under a real tmux pty rendered its full TUI (menu bar, disassembly pane, hex dump pane, and a modal dialog) and its status bar read the exact predicted `MCP Server active on http://127.0.0.1:3000/mcp` text -- no "not a terminal" or raw-mode failure of any kind.
- **MCP served: PASS.** A real Streamable-HTTP handshake via the official `@modelcontextprotocol/sdk` client (`evidence/mcp-harness.mjs`) returned a genuine 28-tool `r2000_*` tool list from the still-live pty process. The pre-bootstrap `r2000_save_project` call returned the exact predicted `-32603 No active project path` error, explicitly labelled in the transcript as an unrelated precondition failure, not a pty answer in either direction.
- **2b (keystroke-driven bootstrap): PASS.** After dismissing an unplanned "Import Context Setup" modal (a research correction -- not in 09-RESEARCH.md's data-flow diagram), `Alt+S` (tmux `M-s`) opened the Save-As dialog on the **first attempt**, no fallback keystroke encoding needed. The filename field was pre-filled `probe-illegal.regen2000proj` exactly as Assumption A2 predicted. `Enter` completed the save with zero human intervention.
- **Both post-bootstrap confirmations passed:** re-running the harness's `r2000_save_project` against the still-live process now succeeds ("Project saved to ..."), and a **completely fresh, non-pty** `--headless --export_lbl` invocation against the bootstrapped file loaded it and exported a real label file (`al C:c000 .start`), exit 0 -- proving the bootstrap actually unlocks the headless routes, not merely that a file exists on disk.
- Clean teardown proven at every checkpoint: tmux session killed, no `regenerator2000 --mcp-server` process survives, port `:3000` free (`ss -ltn` empty).

## Task Commits

Each task was committed atomically:

1. **Task 1: 2a -- does HTTP MCP mode survive a pty with no real TTY?** - `51e74d6` (feat)
2. **Task 2: Is an MCP client served or refused over 127.0.0.1:3000 in that state?** - `708e7e5` (feat)
3. **Task 3: 2b -- drive Save-As with no human, then prove --headless loads the result** - `c586170` (feat)

_No plan-metadata commit yet -- this SUMMARY.md is committed next, per the sequential-executor protocol. STATE.md/ROADMAP.md are NOT updated by this worktree agent; the orchestrator owns those writes after all wave-2 agents complete._

## Files Created/Modified

- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pty-transcript.txt` - full criterion-2 transcript: route selection, launch, pty-tolerance verdict, MCP handshake, keystroke-driven bootstrap, both post-bootstrap confirmations, teardown
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-initial.txt` - captured tmux pane immediately after launch (TUI drawn, Import Context Setup modal, MCP server status line)
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-after-alt-s.txt` - captured pane showing the Save-As dialog with its pre-filled filename field
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion2-pane-after-enter.txt` - captured pane showing "Project saved: probe-illegal.regen2000proj" in the status bar
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs` - throwaway `StreamableHTTPClientTransport` client, argv-driven tool name/arguments, no `curl`, resolved against the vendored SDK via a `node_modules` symlink in `$PROBE_DIR`

No files under `.claude/mcp/vice/` were touched (`git diff --stat -- .claude/mcp/vice/` confirmed empty after every task). No `npm install` was run.

## Decisions Made

- **Route: tmux, not the Python pty fallback.** tmux 3.5a was confirmed on PATH (installed by the human during plan 09-01), so the stronger real-terminal-emulation route was used throughout; `evidence/pty-driver.py` was deliberately not created, per the inherited findings' explicit instruction.
- **The "Import Context Setup" modal was dismissed with Enter, not treated as a keystroke-sequence failure.** It is a real, unplanned addition to the bootstrap sequence that 09-RESEARCH.md's data-flow diagram did not show; recorded as a `## RESEARCH CORRECTIONS`-style note inline in the transcript rather than as a plan deviation, since it did not require any code change or Rule 1-4 action -- only an additional keystroke in the probe sequence itself.
- **2a and 2b scored as two separate outcome lines, never conflated.** `PTY_TOLERANCE: pass` was recorded and committed (Task 1) before any keystroke-bootstrap attempt was made (Task 3), per the plan's scoring discipline and Evidence Integrity Rule 5's precondition-failure guidance.
- **The pre-bootstrap `-32603` error was explicitly labelled via `PRECONDITION_NOTE:`** so no later reader of this transcript scores it as a probe result.

## Deviations from Plan

None (Rule 1-4) requiring code changes. One inline research correction was recorded (the unanticipated "Import Context Setup" modal), handled by adding one extra, harmless keystroke (`Enter`) to the observed sequence -- this is exactly the kind of real-world observation the plan asked this probe to surface, not a deviation from the plan's own instructions.

## Issues Encountered

None. All three tasks completed without a blocked or `could-not-run` outcome. The tmux Bash-command classifier in this harness rejected multi-statement shell loop scripts (polling loops, brace-grouped redirects) as "too complex to verify inside the worktree" -- worked around by issuing single, simple commands (one `tmux capture-pane` / `tmux has-session` call at a time) rather than a scripted polling loop; well within the plan's 90-second bound in every case. Not a regenerator2000 or pty finding -- a property of this execution harness, noted here for future plans in this phase that also drive tmux interactively.

## User Setup Required

None. No external service configuration required. tmux and regenerator2000 were already installed on this host from plan 09-01's checkpoint.

## Next Phase Readiness

**Ready for wave 3 (plans 09-04, 09-05, 09-06):**

- `PROJECT_FILE: /home/henrik/.cache/c64-re-tools/phase9/probe-illegal.regen2000proj` exists, is worktree-independent, and is **proven functional** (a fresh `--headless` load succeeded and exported labels) -- wave 3's three plans can consume it directly with no further bootstrap step.
- `evidence/mcp-harness.mjs` and the `$PROBE_DIR/node_modules` symlink pattern are reusable for any later plan needing a real MCP Streamable-HTTP handshake against a live regenerator2000 instance.
- **R2000-09's Phase 10 automated-bootstrap question is answered affirmatively**: the Save-As dialog CAN be driven to completion with no human, via `tmux send-keys` (`Escape` -> dismiss any modal -> `M-s` -> accept/type filename -> `Enter`), with one caveat Phase 10 must account for: an "Import Context Setup" modal may appear first and must be dismissed before Alt+S will register.
- **Open Question 3 (`use_illegal_opcodes`) remains open for wave 3's criterion 3(2)** as expected -- this plan observed (not scored) that auto-analysis rendered the fixture's illegal-opcode bytes as `.byte $xx ; Invalid or partial instruction` rather than as `lax`/`sax`/etc mnemonics, suggesting the setting does NOT flip automatically on load; wave 3 should verify this explicitly against `--verify --assembler acme`.
- Port `:3000` is free and no `regenerator2000` process from this plan survives -- wave 3 will not collide with a leftover listener.

No blockers for wave 3.

---
*Phase: 09-the-assumption-probe-go-no-go*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 5 created evidence files verified present on disk (`criterion2-pty-transcript.txt`,
`criterion2-pane-initial.txt`, `criterion2-pane-after-alt-s.txt`,
`criterion2-pane-after-enter.txt`, `mcp-harness.mjs`), plus this SUMMARY.md itself.
All 3 task commits (`51e74d6`, `708e7e5`, `c586170`) verified present in `git log`.
