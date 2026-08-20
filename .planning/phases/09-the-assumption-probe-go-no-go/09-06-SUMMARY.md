---
phase: 09-the-assumption-probe-go-no-go
plan: 06
subsystem: infra
tags: [regenerator2000, vice-snapshot, stock-vice, vsf, mcp, probe]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "A bootstrapped .regen2000proj file, evidence/mcp-harness.mjs and evidence/vice-tool-harness.mjs (from 09-03/09-05), and the probe fixture (probe-illegal.prg, 44 bytes at $c000) from 09-01"
provides:
  - "R2000-16(4) answered `partial`, by direct interrogation against a real live emulator and a real regenerator2000 build: a .vsf produced by vice_snapshot_save genuinely carries its own start address (entry point/PC) and memory content, but its displayed machine type traces to a coincidental default fallback rather than a genuine read of the snapshot's own machine_name field"
  - "A real, load-bearing cross-session finding about this project's own broker: vice_memory_write and vice_snapshot_save issued as separate MCP client connections are not guaranteed to observe the same live machine state, even against the same broker-managed process -- caught by re-interrogating the first snapshot's own bytes rather than trusting the earlier same-invocation read-back"
  - "A real regenerator2000 0.9.20 defect: r2000_get_address_details is unconditionally broken for any full-64K load due to a u16 overflow in handler.rs's bounds check"
  - "An accepted limit for Phase 10/11: regenerator2000's auto-detected system for a stock-VICE .vsf must not be trusted -- verify or set it explicitly"
affects: [09-07, 09-08]

tech-stack:
  added: []
  patterns: ["issuing every step of a write-then-snapshot sequence within a single MCP client connection, never split across separate tool invocations, when the broker's on-demand pool is in play", "interrogating a binary file's own bytes directly (independent parser mirroring the actually-installed source) rather than trusting either the producing tool's or the consuming tool's claim about it"]

key-files:
  created:
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion4-vsf-load.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion4-vsf-pane.txt
    - .planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/vsf-probe.export.a
  modified: []

key-decisions:
  - "Discovered during Task 3's own independent interrogation that the first snapshot did not carry the fixture bytes at $c000, despite an earlier same-invocation read-back confirming them -- traced to a genuine cross-MCP-connection session-continuity gap in the broker's on-demand pool, not a mistake to silently redo; documented in full, then fixed by reissuing the whole write-then-snapshot sequence in one connection"
  - "Scored VSF_LOAD as partial rather than pass: the displayed machine type (\"Commodore 64\") is correct in value but traced at the source level to a coincidental default fallback (dialog_import_context.rs's unwrap_or(current_system)), not a genuine derivation from the snapshot's own machine_name field (\"C64SC\", which matches none of file_io.rs's literal match arms) -- a value that happens to be right is not the same as a value genuinely derived, per Evidence Integrity Rule 6"
  - "Treated the export's `* = $0000` origin directive as a separate, non-comparison field from the snapshot's own start_address (the entry point/PC) -- the plan's own boilerplate language anticipated conflating these by analogy to .bin/.raw, but a full-64K .vsf's $0000 origin is structurally correct (the whole address space, not a partial blob, is loaded at offset 0), so the genuinely-carried start address is the entry point, which matched exactly"
  - "Recorded, but did not score against this criterion, a real regenerator2000 defect (r2000_get_address_details always reports OutOfRange for a full-64K load) discovered incidentally while looking for a suitable live analysis tool"

requirements-completed: [R2000-16]

duration: ~50min active work (tasks 1-3, including the cross-session correction and re-run)
completed: 2026-08-20
---

# Phase 09 Plan 06: The Snapshot Interrogation Probe (criterion 3(4)) Summary

**R2000-16(4) answered `partial`: a real `.vsf` from `vice_snapshot_save` genuinely carries its start address (entry point/PC, `$e5d4`) and memory content (the fixture's 44 bytes at `$c000`, byte-identical) into regenerator2000, but its displayed machine type ("Commodore 64") is a coincidental default fallback rather than a genuine read of the snapshot's own `"C64SC"` machine-name field — plus a real cross-session broker finding caught and fixed mid-task, and a real regenerator2000 defect recorded separately.**

## Performance

- **Duration:** ~50 min active execution across three tasks, including a full mid-task correction and re-run of Tasks 1-3's live steps
- **Tasks:** 3/3
- **Files modified:** 3 evidence files created (0 product files touched; `git diff --stat -- .claude/mcp/vice/` confirmed empty)

## Accomplishments

- **A real `.vsf` was produced, byte-level interrogated, and found to genuinely carry its own start address (entry point/PC) and memory content — but not a genuinely-derived machine type.** Independent, from-scratch parsing of the snapshot's own bytes (mirroring the actually-installed `regenerator2000-core-0.9.20` parser's exact offsets, not trusting either producer or consumer tool) confirmed: `machine_name = "C64SC"`, `MAINCPU PC = $e5d4`, and the C64MEM module carrying the fixture's 44 bytes byte-identical. regenerator2000's Import Context Setup modal and its own `r2000_get_binary_info`/`r2000_get_disassembly_cursor` MCP tools agreed with the entry point and memory content exactly, but the displayed "Commodore 64" traces — at the source level, in `dialog_import_context.rs:37`'s `unwrap_or(current_system)` — to a fallback default, not a real read of `"C64SC"` (which matches none of `file_io.rs`'s literal `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"` arms).
- **A real, self-caught mistake, corrected inline rather than hidden.** The first snapshot-production attempt split `vice_memory_write`/`vice_memory_read` and the later `vice_snapshot_save` across separate MCP client connections. The write's own same-connection read-back looked correct, but Task 3's independent re-parse of the produced `.vsf` showed the fixture bytes were NOT actually in it — VICE's own uninitialised-RAM pattern was there instead. Root-caused to this project's own broker session model ("the connection itself IS the lease") rather than assumed away, then fixed by reissuing the entire sequence in one connection and independently re-confirming the corrected file byte-identical.
- **A real regenerator2000 defect found and recorded (not scored against this criterion):** `r2000_get_address_details` is unconditionally broken for any full-64K load — `handler.rs:1894`'s bounds check casts `raw_data.len()` (`65536`) to `u16`, which overflows to `0`, making the check always true.
- **`VSF_LOAD: partial`**, decided by Evidence Integrity Rule 6's own standard: a value that happens to display correctly is not the same as a value genuinely derived from the snapshot. Two of the criterion's fields (start address, memory content) are genuine passes; the third (machine type) is not, on provenance grounds established by direct source tracing, not inference.
- Clean teardown proven throughout: broker, all `x64sc` instances, and every `regenerator2000`/`tmux` session confirmed gone; port `:3000` free; pre-existing unrelated listeners (`6600-6602`) left untouched.

## Task Commits

Each task was committed atomically (Task 3's commit also carries the mid-task correction to Task 1/2's own transcript sections, discovered and fixed within Task 3's own work):

1. **Task 1: Produce a real snapshot from a live emulator, and record what it carries** - `858281f` (feat)
2. **Task 2: Load the snapshot into regenerator2000 and bootstrap a project from it** - `c6912cf` (feat)
3. **Task 3: Interrogate what regenerator2000 derived, compare, and correct the Task 1 cross-session finding** - `e18eb5f` (feat)

_No plan-metadata commit yet -- this SUMMARY.md is committed next, per the sequential-executor protocol. STATE.md/ROADMAP.md are NOT updated by this worktree agent; the orchestrator owns those writes after all wave-3 agents complete._

## Files Created/Modified

- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion4-vsf-load.txt` - full criterion-3(4) transcript: snapshot production (both the discarded first attempt and the corrected single-session run), independent byte-level `.vsf` interrogation, the pty bootstrap, live MCP queries, the export/comparison, and all outcome lines
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/criterion4-vsf-pane.txt` - six labelled pane captures (three from the superseded first snapshot, three from the corrected one) showing the Import Context Setup modal, Save-As dialog, and post-save state
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/exports/vsf-probe.export.a` - the full `--headless --export_asm` output from the corrected snapshot's project (65,546 lines — one `.byte` per address across the full 64K image plus a small flow-analyzed Code region at the entry point), kept in full per this plan's own file spec

No files under `.claude/mcp/vice/` were touched. `09-RESEARCH.md` was not modified (corrections recorded in the transcript's `## RESEARCH CORRECTIONS` section instead, per this plan's own instruction that plan 09-07 owns that file).

## Key evidence lines (verbatim, for plan 09-07)

```
SNAPSHOT_FILE: /home/henrik/dev/henrik/git/c64-re-tools/.vice-snapshots/r2000_probe_vsf_v2.vsf
SNAPSHOT_FILE_IS_VSF: yes
SNAPSHOT_CARRIED: machine_name (raw, from file) = "C64SC"; suggested_system match per file_io.rs's own logic = None; PC (from file, MAINCPU module offset 12-13) = $e5d4; PC (live register read, same session, moments before the snapshot) = $e5d4 (exact match); C64MEM module present, and the fixture's 44 bytes at $c000 are present byte-identical.
R2000_DERIVED: machine type = "Commodore 64" (stated, provenance mismatch); start address (entry point/PC) = $e5d4 (genuinely derived, matches); export origin directive = $0000 (structurally expected for a full-64K load, not a comparison field).
VSF_LOAD: partial
```

## Decisions Made

- **Corrected the cross-session finding in place, in the same file, rather than silently redoing Tasks 1-2 and discarding the evidence of the mistake** — the original attempt's evidence is real and instructive (it exposes a genuine gap in the broker's session model that any future `.vsf`-producing skill needs to know about), so it was kept, clearly labelled `SUPERSEDED`, alongside the corrected run.
- **Scored the machine-type field on provenance, not on the displayed value** — per Evidence Integrity Rule 6's explicit prohibition on "it did not crash" (or, here, "it happens to say the right thing") standing in for a genuine check.
- **Treated the export's `* = $0000` origin directive as a separate field from the snapshot's own `start_address`**, since the actually-installed parser's own struct names the field `start_address` and populates it from the MAINCPU PC, never from the export's origin directive — the plan's own anticipated failure signature (by analogy to `.bin`/`.raw`) does not apply to a full-64K `.vsf` load, and the transcript states this explicitly rather than mechanically applying the anticipated framing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vice_machine_config_get` does not exist on the stock backend**
- **Found during:** Task 1
- **Issue:** The plan's own read_first list assumed this tool exists on stock; it is fork-only (descoped, per `PROJECT.md`'s own decision record)
- **Fix:** Substituted the broker's own launch argv (`/usr/bin/x64sc`, definitionally C64/C64SC) plus `vice_ping`'s `viceVersion` as the independent "machine's own view of its model" reading
- **Files modified:** none (evidence only)
- **Committed in:** `858281f` (Task 1 commit)

**2. [Rule 1 - Bug] The first snapshot did not carry the fixture bytes, due to a cross-connection session-continuity gap**
- **Found during:** Task 3 (while independently interrogating the snapshot before scoring it)
- **Issue:** `vice_memory_write`/`vice_memory_read` and `vice_snapshot_save` were issued as three separate MCP client connections; the write's own same-connection read-back was correct, but the later snapshot did not carry it
- **Fix:** Reissued `vice_ping`, `vice_registers_get`, `vice_memory_write`, `vice_memory_read` and `vice_snapshot_save` in one single harness invocation (one connection); independently re-verified the corrected `.vsf` byte-identical at `$c000`; redrove the pty bootstrap and export against the corrected file
- **Files modified:** `evidence/criterion4-vsf-load.txt`, `evidence/criterion4-vsf-pane.txt`, `evidence/exports/vsf-probe.export.a`
- **Verification:** Direct byte-level re-parse of the corrected `.vsf`'s C64MEM module, independent of any tool's own claim
- **Committed in:** `e18eb5f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 substitution, 1 Rule 1 bug fix)
**Impact on plan:** Both were necessary for an honest answer to the criterion; the Rule 1 fix is itself one of this plan's most valuable findings, since it reveals a real gap in the broker's session model that bears on future work. No scope creep — no product code was touched.

## Issues Encountered

- A real regenerator2000 0.9.20 defect (`r2000_get_address_details` always reports `OutOfRange` for a full-64K load, traced to a `u16` overflow in `handler.rs:1894`) was found incidentally while choosing a live analysis tool. Not scored against this criterion (neither R2000-16(4) nor its acceptance criteria mention this tool) and not worked around — the two tools this task actually needed (`r2000_get_binary_info`, `r2000_get_disassembly_cursor`) already answered what was required. Recorded in the transcript for Phase 10/11 to track.
- The broker recycled its warm instance to a different port between tasks (6603/6604 to 6605/6606) with the same broker PID throughout — noted at final teardown, not investigated further since it did not affect this plan's own evidence chain (the corrected snapshot's own single-connection sequence was self-contained).

## User Setup Required

None. No external service configuration required. The stock VICE binary (`/usr/bin/x64sc`, VICE 3.9) and `tmux` were already present on this host from earlier phase work.

## Next Phase Readiness

**Ready for plan 09-07 (findings synthesis) and 09-08 (verdict):**

- `SNAPSHOT_FILE_IS_VSF: yes`, `SNAPSHOT_CARRIED:`, `R2000_DERIVED:` and `VSF_LOAD: partial` are all recorded verbatim in `evidence/criterion4-vsf-load.txt` for 09-07 to read directly, plus a `## COMPARISON` block with a per-field verdict and an `## ACCEPTED LIMIT` block naming exactly what Phase 10/11 must not assume (regenerator2000's auto-detected system for a stock-VICE `.vsf`).
- The `## RESEARCH CORRECTIONS` section documents five items for 09-07 to fold into `09-RESEARCH.md`: the `self.origin`-vs-`entry_point` distinction for `.vsf` loads (not previously documented), the `"C64SC"` vs `"C64"` machine-name mismatch, the `r2000_get_address_details` defect, and the cross-connection session-continuity finding about this project's own broker.
- Port `:3000` is free and no `regenerator2000`/`x64sc`/`vice-broker.mjs` process from this plan survives.
- The cross-connection session-continuity finding (item 5 in `## RESEARCH CORRECTIONS`) is directly relevant to any future `.vsf`-based extension of `c64-ram-capture` and should be flagged for whichever later plan builds that route.

No blockers for the remaining wave-3/synthesis plans.

---
*Phase: 09-the-assumption-probe-go-no-go*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 3 created evidence files verified present on disk (`criterion4-vsf-load.txt`,
`criterion4-vsf-pane.txt`, `exports/vsf-probe.export.a`), plus this SUMMARY.md
itself. All 3 task commits (`858281f`, `c6912cf`, `e18eb5f`) verified present
in `git log`.
