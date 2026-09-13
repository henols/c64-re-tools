---
phase: quick-260913-kwg
plan: 01
subsystem: fixtures
tags: [vice, hazard-subject, autostart, fixture-design, negative-control]

requires:
  - phase: quick-260913-jgv
    provides: the two-register amendment ($dd00/$d011 stated as immediate loads) and regenerated committed images this task re-observes
provides:
  - a re-taken `## On-screen observations` section in FIXTURE-DESIGN.md, grounded in captures taken in this run rather than transcribed prose
  - a documented, reproduced finding that `-autostart` never loads any of five distinct .prg files on this VICE installation, disqualifying every autostart-route screenshot as per-program evidence
  - a gitignored evidence manifest (`.c64-re-tools/runs/hazard-screens/MANIFEST.txt`) with 8 captures, each with md5, byte size, exit status and argv
affects: [hazard-subject fixture documentation, any future work trusting -autostart screenshots on this host]

actuals:
  tokens: 3109
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "instrument-qualification-before-trust: a positive control (readable screen) and a negative control (unrelated program, identical route) run before any per-program on-screen claim is written"

key-files:
  created: []
  modified:
    - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md

key-decisions:
  - "The negative control (petcat's computed-sys.prg) produced the identical screenshot md5 as the hazard-subject aligned build through the identical -autostart route, so the route was investigated rather than trusted -- and found to fail identically (VICE's own 'No idea what disk image format to use') for every one of five distinct .prg files tried, including both pre- and post-amendment images and the misaligned twin. No -autostart capture in this run ever loaded a program at all."
  - "A second, independent instrument (the binary monitor's own AUTOSTART wire command, 0xdd) was attempted to sidestep the CLI-level failure; it refused with error code 0x8f (CmdFailure), confirming the failure is not a CLI-argument quirk. No vice-broker systemd unit exists on this host, so the project's own supported MCP-tool route was not reachable either."
  - "The pre-amendment (commit 758d7df6) and post-amendment images produce byte-identical screenshots through the disqualified route, but that equality is recorded as worth nothing -- not as evidence the amendment left behaviour unchanged -- because neither ever ran."
  - "The superseded aligned/mis-aligned observations (which described the pre-amendment bytes) are preserved verbatim under an explicit subsection rather than deleted or overwritten, since they are history about bytes no longer committed."

requirements-completed: [QUICK-260913-kwg]

duration: 35min
completed: 2026-09-13
status: complete
---

# Phase quick-260913-kwg Plan 01: Re-record the hazard subject's on-screen observations Summary

**Re-took every on-screen observation from fresh captures against genuine stock VICE 3.9, and found the `-autostart` route itself is broken on this installation -- it never loads any of five distinct programs tried, which is why post- and pre-amendment images, and an unrelated negative-control program, all produced byte-identical screenshots.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3/3 completed
- **Files changed:** 1 (`src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md`)
- **Commits:** 1

## Accomplishments

- Took a positive control (no `-autostart`, cycle limit 5,000,000) and visually confirmed, by opening the PNG, that it shows a readable ordinary BASIC start-up screen -- establishing the capture rig by inspection, not by file size.
- Took a negative control -- the unrelated committed `petcat` fixture `computed-sys.prg` -- through the identical `-autostart`/20,000,000-cycle/`-exitscreenshot` route used for the hazard subject's aligned build, and found it produced the SAME md5 as the aligned build's own capture. Rather than stopping at that correlation, investigated the cause: every emulator log for every `-autostart` invocation in this run (five distinct `.prg` files) recorded the identical failure, `AUTOSTART: Error - No idea what disk image format to use` / `Error - Failed to autostart`. No program was ever loaded by any `-autostart` capture on this host in this run.
- Attempted a second, independent instrument to settle the amended registers ($dd00/$d011) more sharply than a screenshot: no `vice-broker` systemd unit exists on this host (route (a), the project's own supported path, was not reachable), so tried the binary monitor directly (route (b)). A CLI-level combination of `-autostart` with `-binarymonitor` bound briefly but then the whole process exited on the autostart failure; a second attempt, issuing the binary monitor's own `AUTOSTART` wire command (0xdd) against a process launched without CLI autostart, refused with error code 0x8f (CmdFailure) -- confirming the failure is not a CLI-argument quirk. Two attempts is the box the plan set for this instrument; both refused, and neither yielded a register or memory read from a machine that had actually executed either image.
- Extracted the pre-amendment aligned and mis-aligned images from commit `758d7df6` into the session scratchpad (not the repo tree) and pushed them through the identical harness: both produced the same screenshot md5 as every other `-autostart` capture in this run. Recorded this equality as worth nothing as evidence about the amendment, since the disqualified route never ran any of the images being compared.
- Rewrote `## On-screen observations` in `FIXTURE-DESIGN.md`: an INSTRUMENT paragraph stating the argv shape, the two controls and their consequence; fresh PREDICTION/OBSERVATION pairs for the aligned and mis-aligned builds (both OBSERVATIONs: a uniformly black frame, explained by the disqualified instrument rather than interpreted as the four predicted effects failing to render); a paragraph on the pre-/post-amendment comparison; an explicit sentence that the isolated single-construction builds were not re-measured; and the prior aligned/mis-aligned observations preserved verbatim under a new "Superseded observations (pre-amendment bytes, commit `758d7df6`)" subsection. The closing "What no automated check in this repository can establish" paragraph is retained, with one added sentence noting the autostart failure itself was found only by direct log inspection, not by any automated check.
- Wrote `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` (gitignored) recording 8 captures with md5, byte size, exit status and full argv line each, plus free-text notes on the verdicts. No PNG was committed.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Qualify the capture instrument end-to-end, with a negative control | (no tracked file; manifest is gitignored by design) | `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` |
| 2 | Measure the post-versus-pre-amendment comparison, and try one second instrument | (no tracked file; manifest is gitignored by design) | `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` |
| 3 | Rewrite the on-screen observations section from this run's captures | `cbfebae4` | `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` |

Tasks 1 and 2 produce no tracked git artifact by design (the plan's own halt rule: the manifest and every captured PNG live only under the project's gitignored tool-written root, `.c64-re-tools/runs/hazard-screens/`). Task 3 is the plan's sole tracked-file change and is the only commit in this plan.

## Deviations from Plan

### Auto-fixed Issues

None -- no code required fixing under this plan's scope (the ONLY product file this plan may touch is `FIXTURE-DESIGN.md`, and no bug was found in it; the finding is about the emulator installation's `-autostart` behavior, which is environmental, not something this plan is permitted or asked to fix).

### Notable deviations from the plan's own working assumptions

- **Deeper root cause than "program-blind."** The plan's planning-time notes framed the central risk as the route being unable to distinguish one program from another. The actual finding in this run is stronger: the route never loaded ANY program at all -- confirmed independently through two different code paths (the CLI `-autostart` flag and the binary monitor's own `AUTOSTART` wire command), both failing with the same VICE-level diagnostic. This is recorded in the document as the reason for the program-blindness, not merely alongside it.
- **Two extra, uncited exploratory captures.** Two further captures (a repeat of the aligned build's autostart failure at the positive control's own cycle limit, and a repeat of the positive control at the autostart-captures' own cycle limit) were taken to rule out a "reversion happens gradually over time" explanation for the black frame. Neither is cited in the document (the document's md5s are unaffected), but both are recorded in `MANIFEST.txt` for completeness, since every PNG file in that directory should have a manifest entry explaining it.

## Known Stubs

None. The section makes no claim it cannot support; where the instrument could not establish something, the document says so explicitly rather than presenting a stub value.

## Threat Flags

None. This plan's own threat register (T-kwg-01 through T-kwg-04) covers the actual surface touched; no new surface was introduced.

## Verification

- `MANIFEST.txt` exists under `.c64-re-tools/runs/hazard-screens/` with 8 `capture` records, each with an md5, byte size, exit status and argv line.
- `git diff --name-only HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/` returns empty post-commit (the one change is now in HEAD); pre-commit it printed exactly `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md`, matching the plan's gate.
- `git status --porcelain` shows no new tracked PNG.
- Every md5 appearing in `FIXTURE-DESIGN.md` (4 unique values) also appears in `MANIFEST.txt`.
- `npm run test:automated` (from `src/mcp/vice`, no broker running): 4392 tests, 4375 pass, 8 fail, 9 skipped. All 8 failures are pre-existing planning-document integrity checks (audit disposition, register-manifest staleness, milestone-gate redness) unrelated to `hazard-subject` or `FIXTURE-DESIGN.md` -- every hazard-related test in the suite passed. Skip count (9) matches the previously recorded baseline.
- `pgrep -c x64sc` returns 0 after this run; no VICE process or broker was left running.

## Self-Check: PASSED

- FOUND: `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` (modified, committed)
- FOUND: `/home/henrik/dev/henrik/git/c64-re-tools/.c64-re-tools/runs/hazard-screens/MANIFEST.txt` (gitignored, 8 captures)
- FOUND: commit `cbfebae4` in `git log --oneline`
- CONFIRMED: `git diff --name-only HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/` is empty (change is committed; the one file changed matches the plan's sole-file gate)
- CONFIRMED: no tracked PNG anywhere (`git status --porcelain` shows only pre-existing untracked non-PNG paths from before this task started)
- CONFIRMED: `pgrep -c x64sc` is 0
