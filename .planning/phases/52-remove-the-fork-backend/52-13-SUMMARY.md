---
phase: 52-remove-the-fork-backend
plan: 13
subsystem: docs
tags: [project-md, decision-log, codebase-snapshots, fork-removal, gap-closure, test-floor]

requires:
  - phase: 52-remove-the-fork-backend
    provides: "52-12's four-file projection census (CLAUDE.md + its three declared source documents) and the verification report's two named residues left open"
provides:
  - "PROJECT.md's two remaining decision-log locations (the SID write-shadowing Out of Scope bullet and its Key Decisions row) reworded from stating the superseded fork-routing as current to stating the permanent, accepted hardware loss, matching the already-amended FORK-01 reversal row's style"
  - "CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md and TESTING.md — the four codebase snapshots no CLAUDE.md marker names as a source — each annotated with a dated supersession note naming precisely what is stale, with no body line touched"
  - "The gap round's closing measurement: six battery gates green, the test suite at the predicted 6-member shrink of the 7-member reference failure set, and the four-file projection census reconfirmed at zero"
affects: [phase-52-verification, future-codebase-mapping-runs]

actuals:
  tokens: 2525
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Reword-in-place, never blank, for a stale decision-log cell — an emptied cell reads as 'no decision was made here', a worse claim than the false one it replaced"
    - "Dated 'SUPERSEDED (date):' prefix inside a decision-log cell, matching the existing 'REVERSED (date):' style already established on the FORK-01 row, so a reader recognizes the same amendment convention at a second location"
    - "Header-only supersession annotation on a codebase snapshot no generator reads as a source — leaves the dated snapshot's body intact as a historical record while warning precisely which claims are stale"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .planning/codebase/CONCERNS.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/TESTING.md

key-decisions:
  - "Reworded both stale PROJECT.md locations in place rather than blanking them: a decision log's purpose is the trail of what was decided and why, and an emptied cell asserts 'no decision was made here' — a different and worse claim than the superseded one it replaced"
  - "Matched the FORK-01 row's existing 'REVERSED (date):' amendment style with a parallel 'SUPERSEDED (date):' prefix at both new locations, rather than inventing a second amendment convention"
  - "Annotated CONCERNS.md/INTEGRATIONS.md/STRUCTURE.md/TESTING.md rather than rewriting or deleting them: none is named as a source by any CLAUDE.md marker, so none can push a falsehood back over the 52-11/52-12 correction (the specific hazard those plans existed to close); rewriting four dated snapshots by hand would be a codebase-mapping run performed with none of a mapping run's tree-derived grounding; deleting them would destroy the record of what the tree looked like at its stated analysis date"
  - "Confirmed, by direct grep against CLAUDE.md's GSD marker comments, that none of the four annotated documents is named as a source (only PROJECT.md, codebase/STACK.md, CONVENTIONS.md and ARCHITECTURE.md are) — checked by command rather than taken on the plan's word"
  - "Did not repair any of the six pre-existing test-floor members, and did not touch the seventh (review-disposition) member beyond confirming its predicted absence — repairing a floor member would destroy the only signal that says whether this round regressed anything"

requirements-completed: [FORKRM-02, FORKRM-03, FORKRM-07]

coverage:
  - id: D1
    description: "PROJECT.md's two remaining stale decision-log locations (Out of Scope SID bullet, Key Decisions SID row) reworded to state the permanent, accepted loss, cite docs/stock-hard-losses.md, and carry a 2026-09-12 supersession date matching the FORK-01 row's style"
    requirement: "FORKRM-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts, docs-constraints-sync.test.ts (both green, 15/15 pass, EXIT=0)"
        status: pass
      - kind: other
        ref: "grep census: routed_a=0, routed_b=0, losses_cited=6, lines=2244 (unchanged), EMPTY_CELLS=0"
        status: pass
    human_judgment: true
    rationale: "A grep census proves the stale phrase is gone and the acceptance record is cited, but only a human read can judge whether the four locations (FORK-01 row, its Out of Scope bullet, and these two reworded rows) actually cohere into one disposition for a reader landing on any one first -- performed as this plan's own <human-check> below, PASS."
  - id: D2
    description: "CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md and TESTING.md each gain a dated header note naming precisely which content (backend, transport, manifest, probe, per-backend selection, capability table) is superseded and pointing at docs/stock-hard-losses.md, with no body line changed in any of the four"
    requirement: "FORKRM-03"
    verification:
      - kind: other
        ref: "grep census: CONCERNS_note=1, INTEGRATIONS_note=1, STRUCTURE_note=1, TESTING_note=1; BODY_CHANGED: (empty); NAMED_AS_SOURCE: (empty)"
        status: pass
    human_judgment: true
    rationale: "The census proves a note exists, cites the acceptance record, and that no body line moved, but only a human read can judge whether each note is precise enough to warn a reader without inviting them to discount the whole document -- performed as this plan's own <human-check> below, PASS."
  - id: D3
    description: "Closing battery: six named gates green, the automated suite at the predicted 6-member shrink of the 7-member verification-report reference set with no new/unexplained member, a non-empty total test count, and the four-file projection census reconfirmed at zero"
    requirement: "FORKRM-07"
    verification:
      - kind: other
        ref: "typecheck=0, smoke=0, pkg=0, honesty=0, coverage=0, cli=0; SUITE_EXIT=1 (expected), TOTAL=4107, failure SET = 6 members exactly matching the documented floor; GUARDS=0 (39/39); PROJECTION_CENSUS=0"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 13: Reword two residual decision rows, annotate four unprojected snapshots, and close the gap round Summary

**Reworded PROJECT.md's two remaining locations still stating SID read-back routes to the removed fork backend, annotated the four codebase snapshots no CLAUDE.md marker reads as a source, and closed the round with the test suite landing exactly at the predicted 6-member shrink of the verification report's 7-member reference set.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-12T13:30:00Z (approx.)
- **Completed:** 2026-09-12T14:05:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Reworded `.planning/PROJECT.md`'s two residual decision-log locations that still asserted, present tense, that SID read-back is covered because it routes to the removed fork backend: the `### Out of Scope` bullet ("Client-side SID write-shadowing mitigation") and the `## Key Decisions` row ("No SID write-shadowing mitigation"). Both now read **`SUPERSEDED (2026-09-12)`** — the same amendment style the FORK-01 row already established — stating the loss is permanent and hardware-caused (`$D400`–`$D418` is write-only in hardware; the binary monitor has no SID read command) rather than routed, and citing `docs/stock-hard-losses.md`. Neither cell was blanked; both remain as reworded rows carrying the full decision trail.
- Confirmed the four-way consistency the verification report found had not been checked: the FORK-01 Key Decisions row, its Out of Scope "Re-adding the fork backend" bullet, and these two newly reworded locations all now state the same current disposition — the fork is removed, SID read-back (among the other two hard losses) is a permanent accepted hardware loss, not a routed one, recorded in `docs/stock-hard-losses.md`. A reader landing on any of the four first reaches the identical answer.
- Annotated `.planning/codebase/CONCERNS.md`, `INTEGRATIONS.md`, `STRUCTURE.md` and `TESTING.md` — confirmed by direct grep against `CLAUDE.md`'s `GSD:` marker comments that none of the four is named as a source (only `PROJECT.md`, `codebase/STACK.md`, `CONVENTIONS.md` and `ARCHITECTURE.md` carry markers) — with a dated `SUPERSEDED note (2026-09-12)` in each header, naming precisely that the backend, its transport, its manifest, its probe, its per-backend selection and its capability table are stale, and pointing at `docs/stock-hard-losses.md`. No line at or below each file's 30th line changed.
- Ran the closing battery. All six named gates (typecheck, smoke, published-package check, capability-honesty check, skill tool-coverage check, documented CLI-invocation check) exited 0. The automated suite exited 1 (expected at the documented floor) over **4107** tests, with a sorted failure SET of exactly the **6** pre-existing members the verification report's Truth 7 named as the unchanged floor — the 7th named member (`every REVIEW.md finding id ... has a recorded disposition (AUDIT-01, self-applied)`) is absent, exactly the shrink the verification report predicted once its own record was committed. No member outside the reference set appeared; neither of the two known outside-the-floor flakes appeared. Re-ran the four document guards (39/39 pass) and the plan 52-12 four-file projection census (`PROJECTION_CENSUS=0`), confirming no earlier wave was undone.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reword the two decision rows that still state the superseded routing as the current answer** - `7e97c5f7` (docs)
2. **Task 2: Annotate the four codebase documents no projection reads, and record why annotation rather than rewrite** - `57a8983b` (docs)
3. **Task 3: Run the closing battery and record the failure SET for this gap round** - no commit (measurement-only task, modifies no repository file, per the plan's own `<files>` declaration)

**Plan metadata:** commit follows (this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `.planning/PROJECT.md` — the SID write-shadowing Out of Scope bullet and its Key Decisions row reworded from stating current fork-routing to stating the permanent, accepted hardware loss.
- `.planning/codebase/CONCERNS.md` — dated supersession note added beside its existing `<!-- refreshed: 2026-09-01 -->` marker and Refresh-note paragraph.
- `.planning/codebase/INTEGRATIONS.md` — dated supersession note added beside its Analysis Date line, naming the stale "two backends" framing specifically.
- `.planning/codebase/STRUCTURE.md` — dated supersession note added beside its Analysis Date line, naming the specific deleted files (`vice.ts`, `vice-probe.ts`, `capability-registry.ts`, `fork-deleted-tools.ts`, `tools-manifest.json`) its directory listing still shows.
- `.planning/codebase/TESTING.md` — dated supersession note added beside its Analysis Date line.

## Decisions Made

See `key-decisions` in frontmatter. In summary: reword both stale PROJECT.md locations in place, never blank, matching the FORK-01 row's own amendment style; annotate the four codebase snapshots rather than rewrite or delete them, because none is named as a projection source and rewriting or deleting either destroys or fabricates a dated record; verify the source-naming exclusion by command rather than by the plan's own assertion; and do not repair any pre-existing test-floor member, including the seventh member whose predicted absence this round confirmed rather than assumed.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and `<verify>` commands passed on the first attempt; no fix cycles were needed.

## Verbatim Record — Before and After (Task 1)

**Out of Scope bullet, before:**
> `- **Client-side SID write-shadowing mitigation** — switchability supersedes it. SID read-back routes to the fork backend, which retains \`vice_sid_get_state\`. Shadowing could only ever capture writes the client itself issued, never the running program's, so it was never parity. (Resolves ingest WARNING W1.)`

**Out of Scope bullet, after:**
> `- **Client-side SID write-shadowing mitigation** — **SUPERSEDED** (2026-09-12): switchability no longer covers this. The fork backend SID read-back depended on for \`vice_sid_get_state\` has been removed, so SID read-back is now a permanent, accepted hardware loss rather than a routed one — \`$D400\`–\`$D418\` is write-only in hardware and the binary monitor has no SID read command, a property of the chip, not an unbuilt feature. See \`docs/stock-hard-losses.md\` for the acceptance record. A client-side write-shadow was never going to substitute for the loss regardless: it could only ever capture writes the client itself issued, never the running program's, so it was never parity. (Originally recorded as resolving ingest WARNING W1; that resolution is superseded by the acceptance above, not retracted.)`

**Key Decisions row, before:**
> `| No SID write-shadowing mitigation | Switchability routes SID work to the fork; shadowing was never parity | ✓ Good — held all milestone; \`vice_sid_get_state\` refuses on stock by name |`

**Key Decisions row, after:**
> `| No SID write-shadowing mitigation | **SUPERSEDED** (2026-09-12): switchability no longer covers this — the fork backend it routed SID work to has been removed. SID read-back is now a permanent, accepted hardware loss rather than a routed one (\`$D400\`–\`$D418\` is write-only in hardware; see \`docs/stock-hard-losses.md\`), and shadowing was never parity regardless | ✓ Good — held all milestone; \`vice_sid_get_state\` refuses on stock by name |`

## Four-Way Consistency Read (Task 1)

Four locations a reader can land on first, all now compared together:

1. **FORK-01 Key Decisions row** (already amended, plan 52-01): `**REVERSED** (2026-09-12): the forked VICE MCP backend has been removed...the three hard losses...are now permanent accepted losses...recorded...in \`docs/stock-hard-losses.md\`.`
2. **"Re-adding the fork backend..." Out of Scope bullet** (already amended, plan 52-01): "the hedge rationale...is withdrawn, not merely reduced...See \`docs/stock-hard-losses.md\` for the three losses this acceptance costs."
3. **"Client-side SID write-shadowing mitigation" Out of Scope bullet** (reworded this plan): permanent, accepted hardware loss, cites `docs/stock-hard-losses.md`.
4. **"No SID write-shadowing mitigation" Key Decisions row** (reworded this plan): permanent, accepted hardware loss, cites `docs/stock-hard-losses.md`.

All four state the identical current disposition: the fork backend is gone; SID read-back is one of three permanent, accepted hardware losses; none is routed anywhere; the acceptance record lives at `docs/stock-hard-losses.md`. No location tells a reader a different current answer than the others.

## Header Notes Verbatim (Task 2)

**CONCERNS.md** (inserted after the existing Refresh note paragraph, before the `---` divider):
> `**SUPERSEDED note (2026-09-12):** This document's description of the emulator backend, that backend's transport, its manifest, its probe, its per-backend selection and its capability table is superseded as of this date — the fork backend (\`barryw/vice-mcp\`, \`-mcpserver\`, \`tools-manifest.json\`) named throughout the section below no longer exists. One emulator target remains: stock VICE, driven over its binary monitor and text channel. The capabilities that have no route on it are recorded in \`docs/stock-hard-losses.md\`. The rest of this document remains a snapshot of its stated Analysis Date above and has not been re-verified.`

**INTEGRATIONS.md** (inserted after the Analysis Date line):
> `**SUPERSEDED note (2026-09-12):** This document's description of the emulator backend, that backend's transport, its manifest, its probe, its per-backend selection and its capability table is superseded as of this date — the "two backends" framing below (fork over HTTP/\`-mcpserver\`, stock over the binary monitor) is no longer accurate. One emulator target remains: stock VICE, driven over its binary monitor and text channel. The capabilities that have no route on it are recorded in \`docs/stock-hard-losses.md\`. The rest of this document remains a snapshot of its stated Analysis Date above and has not been re-verified.`

**STRUCTURE.md** (inserted after the Analysis Date line):
> `**SUPERSEDED note (2026-09-12):** This document's description of the emulator backend, that backend's transport, its manifest, its probe, its per-backend selection and its capability table is superseded as of this date — the fork-backend files it lists below (\`vice.ts\`, \`vice-probe.ts\`, \`capability-registry.ts\`, \`fork-deleted-tools.ts\`, \`tools-manifest.json\`) have been deleted. One emulator target remains: stock VICE, driven over its binary monitor and text channel. The capabilities that have no route on it are recorded in \`docs/stock-hard-losses.md\`. The rest of this document remains a snapshot of its stated Analysis Date above and has not been re-verified.`

**TESTING.md** (inserted after the Analysis Date line):
> `**SUPERSEDED note (2026-09-12):** This document's description of the emulator backend, that backend's transport, its manifest, its probe, its per-backend selection and its capability table is superseded as of this date — any fork-backend test fixtures or per-backend test framing described below refer to a backend that no longer exists. One emulator target remains: stock VICE, driven over its binary monitor and text channel. The capabilities that have no route on it are recorded in \`docs/stock-hard-losses.md\`. The rest of this document remains a snapshot of its stated Analysis Date above and has not been re-verified.`

## Annotate-vs-Rewrite-vs-Delete Decision (Task 2)

**Decision: annotate.** These four documents are annotated with a header note rather than rewritten or deleted.

**Rejected alternative 1 — rewrite.** No `CLAUDE.md` marker names any of these four as a source (confirmed by `grep -aq "GSD:.*source:.*<name>" CLAUDE.md` returning nothing for all four), so unlike `ARCHITECTURE.md`/`STACK.md`/`CONVENTIONS.md` in plan 52-12, none of these can push a stale claim back over a correction — the specific hazard that justified rewriting the three projection sources does not apply here. Rewriting all four by hand anyway would be a codebase-mapping run performed without any of a mapping run's tree-derived grounding (no fresh directory walk, no fresh dependency scan, no fresh test-file census), carrying every inference risk of a mapping run and none of its evidentiary basis. Rejected as work that manufactures claims rather than corrects them.

**Rejected alternative 2 — delete.** These are dated snapshots; deleting them destroys the only record of what the tree looked like at its stated 2026-09-01 analysis date, which is the entire purpose a dated snapshot serves. Rejected because it erases history for no compensating benefit — no reader is protected that the annotation does not already protect, since the note itself now warns precisely which claims are stale.

**Chosen: annotate.** Leaves the record intact, warns the reader precisely which subject matter (backend, transport, manifest, probe, per-backend selection, capability table) is superseded rather than inviting them to discount the whole document, and costs nothing that a future mapping run would not redo anyway.

## Closing Failure SET (Task 3)

**Precondition:** `ps aux | grep -iE 'vice-broker|x64sc' | grep -v grep` produced no output before any measurement — no broker or emulator process was running.

**Battery exit codes (all six expected 0):**
```
typecheck=0
smoke=0
pkg=0 (check-npm-packages.mjs)
honesty=0 (check-skill-capability-honesty.mjs)
coverage=0 (check-skill-tool-coverage.mjs)
cli=0 (check-skill-cli-invocations.mjs)
SUITE_EXIT=1 (expected at the documented floor)
```

**Total test count:** `TOTAL=4107` (above the 4000-test empty-run floor).

**Sorted failure SET — exactly 6 members, all pre-existing, none new:**

1. `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id`
2. `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md`
3. `no milestone audit declares a gated status while any docs guard is red (D-12-02)`
4. `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)`
5. `planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither`
6. `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates`

**Reference set (verification report Truth 7, 7 members) — attribution:**
- Members 1-6 above: present in both the reference set and this run. **Unchanged pre-existing floor.**
- `every REVIEW.md finding id ... has a recorded disposition (AUDIT-01, self-applied)`: present in the reference set, **absent from this run.** This is the **predicted SHRINK** the verification report named — it expected this member to go green once `52-VERIFICATION.md` was committed, which has since happened. Re-measured explicitly rather than assumed, per this task's own instruction to re-check members that read the plan/summary documents this gap round itself writes.

**No member outside the reference set appeared.** The two named flakes (the now-fixed `check-skill-fork-honesty`/`check-skill-tool-coverage` intermittents) did not appear either; their absence is not scored as an improvement.

**Guards and projection census, re-run at this plan's close:**
```
GUARDS=0 (docs-fork-absence.test.ts, docs-fork-decision.test.ts, docs-constraints-sync.test.ts, docs-linerefs.test.ts — 39/39 pass)
PROJECTION_CENSUS=0
```

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- No location a reader naturally reaches in `.planning/PROJECT.md` still states, as the current answer, that a permanently lost hardware capability is served by routing to the removed backend. All four locations bearing on this disposition agree.
- Every codebase snapshot describing the removed backend either has been corrected (plans 52-11, 52-12) or now says in its own header which of its content is superseded and by what (this plan's four).
- The gap round's own measurement regressed nothing: the suite sits at the predicted 6-member shrink of the 7-member reference set, the projection census from plan 52-12 still returns zero, and all four document guards remain green.
- No pre-existing test-floor member was touched. The floor stands at 6 (down from 7, per the predicted shrink) pending any future work that addresses those six directly — none of which is this phase's concern.

## Human Check (from plan `<verification>`)

**Check 1 — read the two reworded decision rows alongside the already-amended reversal row and its out-of-scope bullet.**

Performed as part of this execution (autonomous plan, no separate blocking checkpoint — the plan carries only the plan-level `<verification><human-check>` prose, and `workflow.human_verify_mode: end-of-phase` is the project default). Read all four locations together, quoted verbatim above in "Four-Way Consistency Read". Each states: the fork backend is removed; SID read-back (with matrix keyboard and RESTORE/NMI) is a permanent, accepted hardware loss, not a routed one; the acceptance record is `docs/stock-hard-losses.md`. No location contradicts another, and each carries a 2026-09-12 date in a consistent `**WORD** (date):` style.

**Judgment: PASS.** A reader landing on any one of the four first reaches the identical disposition.

**Check 2 — read the four header supersession notes and judge whether each tells a reader precisely which content to distrust.**

Performed as part of this execution. Each note (quoted verbatim above in "Header Notes Verbatim") names the same six-part subject (backend, transport, manifest, probe, per-backend selection, capability table) as superseded, and each additionally names a document-specific detail confirmed against that document's own body before writing the note: CONCERNS.md's note names the specific fork identifiers (`barryw/vice-mcp`, `-mcpserver`, `tools-manifest.json`) its "Resolved Since The Last Audit" table still discusses in the present tense; INTEGRATIONS.md's note names the stale "two backends" framing its own next paragraph opens with; STRUCTURE.md's note names the five specific deleted files its own directory-tree listing still shows; TESTING.md's note is scoped to fork-backend test fixtures and framing, since the bulk of that document (framework, runner, assertion style) is unrelated to the backend question and is not implicated.

**Judgment: PASS.** Each note is specific to the superseded subject rather than a general staleness warning, so a reader is warned precisely without being invited to discount the parts of each document that remain the best record available (module names, directory structure, test-framework conventions).

## Self-Check: PASSED

- `.planning/PROJECT.md` — reworded rows confirmed present via `grep -ac 'routes to the fork'` = 0, `grep -ac 'routes SID work to the fork'` = 0, `grep -ac 'stock-hard-losses.md'` = 6.
- `.planning/codebase/CONCERNS.md`, `INTEGRATIONS.md`, `STRUCTURE.md`, `TESTING.md` — each confirmed to carry a supersession note in its first 30 lines naming `docs/stock-hard-losses.md`.
- Commits `7e97c5f7`, `57a8983b` both present in `git log --oneline --all` — confirmed.
- `node --test docs-fork-decision.test.ts docs-constraints-sync.test.ts docs-fork-absence.test.ts docs-linerefs.test.ts` — 39/39 pass, exit 0.
- `npm run typecheck`, `npm run smoke`, `check-npm-packages.mjs`, `check-skill-capability-honesty.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-cli-invocations.mjs` — all exit 0.
- `npm run test:automated` — 4107 tests, 4101 pass, 6 fail, exit 1 (expected at the documented floor); failure SET matches the predicted 6-member shrink exactly.
- Four-file projection census (`PROJECTION_CENSUS`) — 0.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
</content>
