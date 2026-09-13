---
phase: quick-260913-m5s
plan: 01
subsystem: testing
tags: [vice, x64sc, autostart, fixture-design, hazard-subject, screen-capture]

# Dependency graph
requires:
  - phase: quick-260913-kwg
    provides: "the disqualified on-screen instrument finding this plan corrects"
provides:
  - "A corrected `## On-screen observations` section in FIXTURE-DESIGN.md with the measured cause (default disk-image autostart mode) replacing the false one (nothing ever loaded / drive-ROM absence)"
  - "An evidence manifest of 16 fresh `p2-` captures under the gitignored tool root, cited by md5 throughout the corrected prose"
affects: [hazard-subject fixture documentation, future screen-capture investigations of this fixture]

# Actuals (#2632)
actuals:
  tokens: 4688
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-route autostart distinction (-autostartprgmode default vs. 1) as the standard way to reason about VICE CLI autostart failures on installations without disk-image infrastructure"

key-files:
  created: []
  modified:
    - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md

key-decisions:
  - "Recorded the true -help finding (the flag DOES appear in this build's -help output, contradicting the plan's planning-time assumption) rather than writing the assumed-but-false claim; see Deviations."
  - "Reported one genuine divergence found at 12,000,000 cycles (subject vs. control) rather than forcing a false 'byte-identical at every moment tried' claim; characterized it as a cursor-blink-phase artifact after direct visual inspection of both frames, since neither shows any of the four predicted effects."

requirements-completed: [QUICK-260913-m5s]

coverage:
  - id: D1
    description: "On-screen observations section's stated cause corrected to the measured mode-default explanation, with the working route named and evidenced from this run's own emulator log"
    requirement: "QUICK-260913-m5s"
    verification:
      - kind: other
        ref: "src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md#On-screen observations (16-point automated verify script run inline, all passed)"
        status: pass
    human_judgment: true
    rationale: "The restated conclusion's strength (bounded negative result vs. overreach) is a prose-quality judgment the plan itself flags for human sign-off."

# Metrics
duration: 35min
completed: 2026-09-13
status: complete
---

# Quick Task 260913-m5s: Correct the on-screen instrument finding Summary

**Replaced the false "autostart never loaded anything, consistent with missing drive ROMs" cause in `FIXTURE-DESIGN.md`'s On-screen observations section with the measured cause: the default `-autostartprgmode` value is the disk-image path (mode 2), which this installation has no disk-image infrastructure for, while `-autostartprgmode 1` (direct RAM injection) genuinely loads and runs the program.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-13T14:07Z (first p2- capture appended to manifest)
- **Completed:** 2026-09-13T14:16Z (commit landed)
- **Tasks:** 2
- **Files modified:** 1 (tracked) + 1 gitignored manifest

## Accomplishments
- Took 16 fresh captures (`p2-*`) this run against genuine stock `/usr/bin/x64sc` (VICE 3.9, Debian package `vice 3.9+dfsg-1`), covering a positive control, default-mode and working-route captures for three distinct programs at 20,000,000 cycles, four mid-execution probes at 2,000,000 / 6,000,000 / 12,000,000 cycles, and the pre-amendment aligned/mis-aligned images from commit `758d7df6` through the working route.
- Confirmed via the emulator's own log lines: the DEFAULT route fails with `AUTOSTART: Error - No idea what disk image format to use` after logging `... with autostart disk image` (mode 2 of `-autostartprgmode`, per this build's own `-help` text); the WORKING route (`-autostartprgmode 1`) logs `... with direct RAM injection` followed by `AUTOSTART: Injecting program data at $0801 (size $08e7)` and `AUTOSTART: Starting program.`
- Retired the drive-ROM explanation on evidence: the plain 1541 ROM this installation's `Drive8Type=0` default wants is present (`1541-c000.325302-01.bin`, `1541-e000.901229-05.bin`); every default-mode capture's log complains only about 1540, 1541-II, 1570, 1571, 1581 and other models, never the plain 1541.
- Corrected the `## On-screen observations` section in place: updated the Instrument paragraph, corrected the cause paragraph, rewrote both build-observation paragraphs with default-mode + working-route pairs, added a new "surviving conclusion, restated" paragraph, updated the post-amendment-vs-pre-amendment paragraph, and added a one-time closing note recommending against further screen-capture investment on this fixture. The `### Superseded observations` subsection and the closing "What no automated check" paragraph are byte-identical to `HEAD` (diff-verified).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce the working load route end-to-end and take this pass's captures** - no commit (all output lands in the gitignored `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` and sibling PNGs/logs; nothing tracked to commit)
2. **Task 2: Correct the stated cause in the on-screen observations section** - `14c12ce1` (fix)

**Plan metadata:** handled by orchestrator (docs commit not made by this agent per constraints)

## Files Created/Modified
- `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` - Corrected `## On-screen observations` section's stated cause, evidence and restated conclusion
- `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` (gitignored) - Appended 16 `capture p2-*` records, a `-help` note, a drive-ROM note, and a four-part verdict comment

## Decisions Made
- Recorded the true, measured `-help` finding rather than the plan's assumed one (see Deviations below) — the whole point of this document is that stated facts are measured, so a false "fact" from planning-time observations does not get transcribed just because the plan expected it.
- Reported the one real subject-vs-control divergence found at 12,000,000 cycles rather than asserting universal byte-identity across every capture moment; characterized it precisely (cursor-blink phase only, both frames otherwise identical, neither showing any predicted effect) after directly viewing both PNGs, so the conclusion is not weakened but is now exactly as strong as the evidence supports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - correcting a false planning-time assumption with a measured fact] `-autostartprgmode` DOES appear in this build's `-help` output**
- **Found during:** Task 1
- **Issue:** Both the plan's `<planning_time_observations>` and the orchestrator's `<execution_notes>` stated as fact that `-autostartprgmode` does not appear in `x64sc -help` output on this build. Direct measurement in this run (`/usr/bin/x64sc -help`, full stdout, 1828 lines, exit 0) shows the opposite: `-autostartprgmode <Mode>` is listed at line 882, with its three modes spelled out verbatim (`0: VirtualFS, 1: Inject, 2: Disk image`).
- **Fix:** The document records the true finding — the flag is present and self-documenting in `-help` on this genuine stock build (Debian package `vice 3.9+dfsg-1`) — rather than the false "absent from -help" claim the plan and a must-have truth both assumed. This is explicitly what the task instructed: "Every claim in the document must come from a capture YOU took in this run," and the failure mode called out twice already in this session is exactly writing an unverified assumption as fact.
- **Files modified:** `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` (the paragraph following the injection-route paragraph)
- **Verification:** Re-ran `/usr/bin/x64sc -help > file; grep -n prgmode file` twice, confirmed consistent result; the mode enumeration in the help text itself independently corroborates the mode-default cause this correction establishes.
- **Committed in:** `14c12ce1` (Task 2 commit)

**2. [Rule 1 - reporting a measured divergence rather than a false universal claim] One of four probed cycle counts showed the subject and control differ**
- **Found during:** Task 1 (mid-execution probes)
- **Issue:** The plan's must-haves expected "byte-identical at every capture moment tried" for the working route. At 12,000,000 cycles, the aligned build (md5 `e9578287a77c2337fee0c73a63be2fe6`) and the unrelated control (md5 `5b86f08792a5480d320dc6d802aca633`) produced different bytes — the one genuine exception among the four cycle counts tried (20,000,000 / 6,000,000 / 2,000,000 all converged).
- **Fix:** Opened both PNGs directly (`p2-mid-12000000-aligned.png` and `p2-mid-12000000-control.png`) and confirmed both show the identical settled `READY.` prompt in default colours with none of the four predicted effects visible in either; the only pixel difference is whether the blinking text cursor is drawn at that instant, because the two unrelated programs return control to BASIC after a different number of cycles. The document reports this honestly as a cursor-blink-phase artifact, not as evidence of a per-program on-screen difference, and states the "byte-identical" claim only for the three cycle counts where it actually held plus a stated exception, rather than asserting a false universal.
- **Files modified:** `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` (the restated-conclusion paragraph)
- **Verification:** Direct visual inspection of both PNGs (described above); md5s cross-checked against the manifest.
- **Committed in:** `14c12ce1` (Task 2 commit)

---

**Total deviations:** 2 (both corrections of assumed-but-false facts with directly measured ones, not scope changes)
**Impact on plan:** Both deviations make the document MORE accurate than the plan's literal wording anticipated, consistent with the plan's own stated principle that stated causes must be measured. No scope creep — only this one file changed, and the section's boundaries (superseded subsection, closing paragraph, preserved sentences) were respected exactly as instructed.

## Issues Encountered
None beyond the two deviations above, both resolved by recording the true measurement.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The corrected section stands on this run's own evidence; every md5 and log line quoted in the document is cross-checked against `.c64-re-tools/runs/hazard-screens/MANIFEST.txt`.
- The document's own new closing note recommends against further screen-capture investment on this fixture, pointing future readers at `hazard-subject-fixture.test.ts`'s byte-level assertions instead.
- No blockers. `pgrep -c x64sc` returns 0; `git diff --name-only HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/` prints exactly the one corrected file; `npm run test:automated` reports the same 7 pre-existing failures and 9 pre-existing skips as before this change (no new failures).

---
*Phase: quick-260913-m5s*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md`
- FOUND: commit `14c12ce1`
- FOUND: `.c64-re-tools/runs/hazard-screens/MANIFEST.txt` (gitignored evidence manifest)
- FOUND: this SUMMARY.md
