---
phase: 50-equivalence-and-modifiability
plan: 08
subsystem: testing
tags: [acme, vice, hazard-report, reassembly-gate, live-capture, exportAsmTree, annotation-store]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability
    provides: "50-01 through 50-07's instruments -- exportAsmTree()/verifyAcmeAssemblesTree() round trip, the reassembly gate and its rule table, the compare-cross-binary comparison tool, the calibrated volatile mask, the pre-registered hazard-subject-modified.allowlist.json, the HAZARD_SUBJECT_PRG_RELPATHS closure, and the CI boundary that scopes this plan's live half to a developer session"
provides:
  - "The first behavioural-modifiability demonstration made in a file exportAsmTree() itself emitted, not a hand-written fixture -- closes EQUIV-03's literal reading"
  - "exported-edit.manifest.json: a committed, byte-level pre-registration pattern for editing exported ACME source with an oracle-checked acceptance contract"
  - "The 'exported-edit' hazard-subject id, reachable through the same closed HAZARD_SUBJECT_PRG_RELPATHS/vice_program_load surface every prior subject uses"
  - "A third live transcript proving the pre-registered allowlist plan 50-03 committed generalizes to a subject whose edit lands at a different byte offset"
affects: [phase-51-and-later, any-future-plan-touching-anno-export-asm.ts-or-acme-verify.ts, any-future-plan-adding-a-hazard-subject]

# Actuals (#2632)
actuals:
  tokens: 41086
  tasks: 3
  commits: 3
  plan_head_before: 1c7a10032f296a8345e85e4a938bcd577da3861b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-registered byte manifest for editing exporter output: a committed JSON declaring exact find/replace source edits plus expected byte deltas, checked against the committed image BEFORE the assembler runs, turning the byte-diff oracle into an acceptance test rather than a rubber stamp"
    - "Test-only CLI seam (--test-corrupt-file) added to an evidence driver solely to make an otherwise-unreachable defensive branch testable, documented inline as never used outside its one test"

key-files:
  created:
    - src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json
    - src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg
    - src/mcp/vice/hazard-subject-exported-edit.test.ts
    - src/mcp/vice/reassembly-gate-exported-edit-run.test.ts
    - docs/phase50-exported-edit-findings.md
    - docs/phase50-exported-modifiability-transcript.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/exported-edit-run.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/50-08-exported-edit-gate-run.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-exported-edit.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-exported-edit.log.json
  modified:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/phase50-transcript-freshness.test.ts

key-decisions:
  - "The added jsr hazard_smc2_entry was placed at the START of the freed sprite region (immediately after sta $d011) rather than immediately before rts, because that position needs no context beyond the immediately-preceding untouched sta $d011 line to be a unique find target for the second, dependent source_edits entry -- a real, measured, byte-level consequence: A reads 0 at the checkpoint in this subject (both original and edited) rather than 5, because the routine's later lda #0/sta $0400 overwrites whatever the construction left in A before the checkpoint."
  - "The primary store route (export the COMMITTED annotation store directly against hazard-subject-exported-edit.prg) was taken, not the refusal path of adding a third SUBJECTS entry to make-hazard-subject-annostore.mjs, because the edit's one-for-one byte-length preservation was measured to round-trip byte-identical before the gate test was written -- this is the STRONGER claim ROADMAP criterion 4 asks for."
  - "The pre-registered hazard-subject-modified.allowlist.json (plan 50-03) was reused completely unchanged. Its broad code-range entry (2170..4095) covers this subject's 20 differing bytes regardless of exact jsr placement, so no allowlist edit was needed -- confirmed live: 28 of this pair's differences allowlisted (vs the hand-written subject's 32, the delta being purely positional), 0 divergences, PASS; the identical pair fails without the allowlist."

requirements-completed: [EQUIV-03]

coverage:
  - id: D1
    description: "One behaviour removed and one added by editing scope_087a.a, a file exportAsmTree() itself emitted, proven by files-list membership and a byte-for-byte 'every other file unchanged' guard"
    requirement: "EQUIV-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-exported-edit.test.ts#the committed .prg is exactly what the committed manifest plus the committed store produce, re-derived"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-exported-edit.test.ts#refusal cases (5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 49's gate re-run over the exported-edit subject through the unmodified gate module, verdict acknowledged (R10), with the page-alignment finding at $088B shown present for the committed subject and absent for the exported-edit one"
    requirement: "EQUIV-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/reassembly-gate-exported-edit-run.test.ts#gate run: the four in-process gate inputs, measured for real against the EXPORTED-EDIT subject and a real assembler"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both behaviour changes observed live on genuine unpatched stock /usr/bin/x64sc: a 64K capture and chip-state sidecar, compared against the original twice one flag apart (PASS with the pre-registered allowlist, FAIL without it), with every reported row attributed to its covering allowlist entry"
    requirement: "EQUIV-03"
    verification: []
    human_judgment: true
    rationale: "A live emulator capture and its cross-binary comparison are this plan's own acceptance evidence, but the transcript's own qualitative claims (that the Red section is a genuine refusal and not an unrelated error, and that no difference was absorbed by widening the allowlist) are exactly what this plan's own Task 3 <verify> designates a human-check for -- automation confirmed the mechanical facts (file sizes, exit statuses, grep-checkable structure); a human reading docs/phase50-exported-modifiability-transcript.md is the design."

duration: 95min
completed: 2026-09-16
status: complete
---

# Phase 50 Plan 08: Modifiability In The Exporter's Own Output Summary

**Closed EQUIV-03's literal reading: edited a file `exportAsmTree()` itself emitted (`scope_087a.a`), reassembled it against a pre-registered byte manifest, re-ran Phase 49's gate over it, and observed both behaviour changes live on genuine stock VICE 3.9 -- with the pre-registered allowlist proven to carry real work a second time, at a different byte offset.**

## Performance

- **Duration:** 95 min
- **Started:** 2026-09-16T09:40:00Z (approx, session start)
- **Completed:** 2026-09-16T10:26:00Z
- **Tasks:** 3
- **Files modified:** 16 (13 created, 3 modified)

## Accomplishments

- **Task 1 (offline, TDD-tagged, exercised through a real subprocess driver):** Produced `hazard-subject-exported-edit.prg` by editing `scope_087a.a` -- the alignment routine's own scope file `exportAsmTree()` emits -- through a committed, pre-registered manifest (`exported-edit.manifest.json`): removed the four sprite-construction stores anchored at `$088B` and added a `jsr hazard_smc2_entry` inside the freed region, anchored at `$0825`. `hazard-subject-exported-edit.test.ts` re-derives the committed `.prg` (never trusts it) and drives five real refusal cases (perturbed byte prediction, unmatched find, ambiguous find, out-of-tree target, a second file mutated behind the driver's back via a test-only seam) each asserting on the refusal's own message.
- **Task 2:** Re-ran Phase 49's gate over the exported-edit subject through the unmodified `reassembly-gate.ts`, reusing the COMMITTED annotation store directly (the round trip was measured to reassemble byte-identical, so no separate annostore was needed). Verdict `acknowledged` (rule R10) -- the identical rule the hand-written modified subject's own run reached. Asserted, in the same run, that the committed subject's hazard report carries the `page-alignment` finding at `$088B` and the exported-edit subject's does not, while `$0881` and `$0825` survive in both and the self-modifying-code construction's own bytes at `$0825`-`$0832` are byte-identical between the two subjects.
- **Task 3 (live):** Resolved `hazard_raster_entry`/`entry` from the exported-edit tree's own real ACME `--symbollist` run (both `$108F`/`$080D`, matching every other subject, for a measured reason). Started the VICE broker as a systemd unit against genuine unpatched stock `/usr/bin/x64sc`, captured the subject at the checkpoint, and compared it against the committed original twice, one flag apart: **PASS** with the plan-50-03 allowlist (28 differences, all covered), **FAIL** without it (the identical 28 as divergences, exit 1). Observed both behaviour changes directly in the captured bytes and registers. Broker stopped and verified down by all four checks before this run ended.

## Task Commits

1. **Task 1: One path, end to end -- the exporter's own output, edited, assembled against a pre-registration, and loadable by id** - `712cf8d0` (feat)
2. **Task 2: Phase 49's gate, re-run over the exported-edit subject, with the removed behaviour's own finding shown disappearing** - `e8278dc4` (feat)
3. **Task 3: The live half -- capture the exported-edit subject, compare it twice one flag apart, and commit the transcript** - `edd26480` (feat)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified

- `src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json` - Committed pre-registration: two source_edits entries (removal, addition) against `scope_087a.a` plus 20 expected_byte_changes rows, each derivable from the committed image before the assembler ran.
- `src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs` - The driver: import → export twice (edit + pristine) → apply edits by exact unique match → prove every other file unchanged → patch expectedBytes → verifyAcmeAssemblesTree() once → derive and cross-check the load address → write the `.prg` and an evidence record. No process-launch call of its own.
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg` - The committed subject; reproducible byte for byte by re-running the driver.
- `src/mcp/vice/hazard-subject-exported-edit.test.ts` - Committed-case re-derivation plus five refusal cases, each run as a real subprocess of the driver.
- `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` - The gate re-run over the exported-edit subject, parameterized from `reassembly-gate-modified-run.test.ts`.
- `docs/phase50-exported-edit-findings.md` - Machine-readable gate verdict (`acknowledged`, R10) with every input cited to a column-0 evidence line.
- `docs/phase50-exported-modifiability-transcript.md` - The live transcript: paired Red/Green comparison sections, both behaviour changes observed from captured bytes, every allowlisted row attributed.
- `.planning/phases/50-equivalence-and-modifiability/evidence/exported-edit-run.json` - Task 1's machine-readable driver run record.
- `.planning/phases/50-equivalence-and-modifiability/evidence/50-08-exported-edit-gate-run.md` - Task 2's four-part evidence file (TREE_REBUILD/MOVEMENT_REBUILD/HAZARD_DISPOSITION/DIFF_SCOPE_COVERAGE, RED_CONTROLS, SECOND_PATH_GUARD, ORDERING_PROOF).
- `.planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin` + `.state.json` + `run-exported-edit.bundle.json` + `.log.json` - The live capture and its chip-state sidecar plus the capture driver's own raw records.
- `src/mcp/vice/text-protocol.ts` - One reviewed `exported-edit` row added to `HAZARD_SUBJECT_PRG_RELPATHS`.
- `src/mcp/vice/tools-manifest.stock.json` - `vice_program_load`'s `subject` enum gains the matching `exported-edit` member.
- `src/mcp/vice/phase50-transcript-freshness.test.ts` - Pinned transcript set gains `phase50-exported-modifiability-transcript.md`, in sorted order.

## Decisions Made

- Placed the added `jsr` at the START of the freed sprite region (right after `sta $d011`) rather than immediately before `rts`, because that position gives the second, dependent manifest edit a naturally unique find-context (the immediately preceding untouched `sta $d011` line) without needing to distinguish among otherwise-identical `nop` runs elsewhere in the file. This produces a real, measured runtime difference from the hand-written modified subject's own placement -- `A` reads `0` at the checkpoint here (matching the original) rather than `5` -- recorded plainly in the transcript rather than assumed to match the sibling subject's own observation.
- Took the primary (stronger) store route for Task 2 -- the committed annotation store exported directly against the new `.prg` -- after measuring the round trip reassembles byte-identical, rather than the plan's offered refusal path of adding a third `SUBJECTS` entry to `make-hazard-subject-annostore.mjs`.
- Reused `hazard-subject-modified.allowlist.json` completely unchanged for the live comparison, per the plan's own prohibition; verified unchanged with `git status --porcelain` both before and after the live half.
- Added a test-only `--test-corrupt-file` CLI seam to `make-exported-edit.mjs` solely to make its "second file mutated behind the driver's back" refusal branch reachable by a real test run (no manifest content can otherwise trigger it, since every manifest-driven edit only ever touches the file it names) -- documented inline as never used outside that one test.

## Deviations from Plan

None - plan executed exactly as written. The plan's own two conditional branches (Task 2's refusal-path store route; a possible checkpoint-address shift in Task 3) were both evaluated and both resolved to their "no divergence needed" outcome, as the plan anticipated and required recording either way.

## Issues Encountered

None. `VICE_BROKER_NODE` had to be pointed at `/home/henrik/.nvm/versions/node/v24.20.0/bin/node` (the system `/usr/bin/node` is v20, below the launcher's v24 floor) -- an environment fact, not a plan defect, and consistent with prior live plans in this phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 50's four success criteria touching EQUIV-03 are now demonstrated in the decomposition's own emitted source, not only in a hand-written twin. `EQUIV-03` is ready to mark complete in REQUIREMENTS.md.
- The `exported-edit` hazard-subject id is now a fourth reviewed row in the closed `HAZARD_SUBJECT_PRG_RELPATHS` table and a fourth `vice_program_load` enum member -- any later plan wanting a fifth live-loadable subject has a proven, low-cost pattern to follow (one manifest, one driver invocation, one committed `.prg`).
- No blockers. Phase 50 has no further plans queued in this plan's own view; `/gsd-verify-work 50` and phase closure are the natural next steps.

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-16*

## Self-Check: PASSED
- All key-files.created verified present on disk with `[ -f ]`.
- All three task commits (712cf8d0, e8278dc4, edd26480) verified present in `git log`.
- `npm run typecheck` clean; `npm run test:automated` 0 fail (3684 pass / 9 skip); `node --test 'src/skills/*/scripts/*.test.mjs'` 0 fail.
- `phase50-transcript-freshness.test.ts` (11/11 pass) confirms the new transcript is fresh, unorphaned, and pairs its Green result with a Red control.
- Broker confirmed stopped: `systemctl --user is-active vice-broker.service` → inactive; no `vice-broker`/`x64sc` process; no listener on 66xx.
