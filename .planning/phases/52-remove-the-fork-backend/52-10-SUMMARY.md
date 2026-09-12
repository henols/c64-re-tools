---
phase: 52-remove-the-fork-backend
plan: 10
subsystem: testing
tags: [fork-backend, vice-mcp, regression-guard, requirements-closure, phase-close]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plans 01-09)
    provides: "every deletion, rewrite and decision this guard now pins in place"
provides:
  - "docs-fork-absence.test.ts — the committed, non-vacuous guard proving the fork backend's removal stays removed"
  - "the phase's closing failure SET, measured against the documented floor with no live broker"
  - "FORKRM-01/04/06/07 closed, all seven Phase 52 requirements now Complete"
affects: []

actuals:
  tokens: 8500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "codeOnly()-stripped identifier scan for shipped .ts/.mts modules, raw-text scan for prose (markdown/CLAUDE.md/README.md) — the same distinction spawn-seam.test.ts already established, reused here so a guard doesn't red on its own siblings' deliberate warning comments"
    - "exempt-path-by-exact-string, not by substring, for the one file (docs/stock-hard-losses.md) allowed to name a removed system"

key-files:
  created:
    - src/mcp/vice/docs-fork-absence.test.ts
  modified:
    - CLAUDE.md
    - .planning/PROJECT.md
    - scripts/audit-gate.mjs
    - src/mcp/vice/audit-integrity.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Fixed the orchestrator-handed defect (CLAUDE.md/.planning/PROJECT.md's Constraints bullet still naming the deleted probeBackend()) in both byte-identical copies in one commit, minimally — one clause rewritten, nothing else touched."
  - "Discovered and fixed a SECOND instance of the identical defect class while building the new guard: CLAUDE.md's (PROJECT.md-independent) Key Abstractions section still listed DENY_LIST/denyListRefusalMessage() as a live abstraction, both deleted by plan 52-05. Removed the stale 3-line entry outright rather than inventing a speculative replacement — there is no current 1:1 successor to a fork-era deny-list-shaped guard. This has no PROJECT.md counterpart (that section does not exist there) and no byte-identity guard covers it, so only CLAUDE.md needed editing."
  - "docs-fork-absence.test.ts's Check 1 scans the shipped .ts/.mts module set through codeOnly() (comments and string/template bodies stripped) rather than raw text. A raw-text scan would have been permanently red on a CORRECT tree: stock-recycle.ts, stock-dispatch.ts, stock-diagnose.ts and anno-tools.ts all carry deliberate prose comments warning a future reader never to reintroduce forwardToVice()/rewriteArguments() — exactly the class of false positive docs-dangling-refs.test.ts's own header warns against ('a guard that false-positives gets switched off rather than obeyed')."
  - "Registered the new guard in scripts/audit-gate.mjs's EXPECTED_DOCS_GUARD_NAMES and its audit-integrity.test.ts mirror, in the same commit as the guard's own addition — required by both files' own stated instruction, and confirmed necessary by running the full suite per Task 2 (it reddened two registry-drift detectors designed for exactly this omission before the fix)."
  - "Criterion 1 reconciled against the literal ROADMAP wording, not against a bare substring grep for the word 'fork'. A raw grep for the literal string \"fork\" across shipped .ts/.mts returns 12 hits: 6 are node_modules/@types/node/cluster.d.ts's own unrelated cluster.fork() API, 5 are comments (including this guard's own explanatory prose and stock-dispatch.ts's historical note that a fork branch was removed rather than left dead), and exactly ONE is real code — text-capability-probe.ts's `type LegacyViceBackend = \"fork\" | \"stock\"`, a deliberate, extensively-documented plan 52-07 decision for detecting an identity DISAGREEMENT (this process's resolved backend vs. what the broker independently reports), not backend SELECTION. Criterion 1's own wording names four specific symbols (VICE_BACKEND, probeBackend(), buildBackendAwareTool(), backend === \"fork\") plus \"no module imports a fork transport\" — all confirmed zero/true. The one surviving type literal matches none of those and does not re-open backend selection, so criterion 1 holds as literally worded; re-litigating plan 52-07's own decision was out of scope for this plan."
  - "vice-proxy.test.ts's stale DENY_LIST-dependent structural tests (readFileSync of the now-deleted vice.ts, would throw if ever executed) were found but NOT fixed — the file is a MANUAL_ONLY_TESTS entry, excluded from npm run test:automated by design, was already flagged by plan 52-04's SUMMARY as owned by 52-06 (which repaired its fork/VICE_BACKEND scaffolding but not this DENY_LIST-specific test), and fixing test bodies in a file outside this plan's files_modified is exactly the kind of scope expansion the plan's prohibitions warn against. Recorded to .planning/WINDOWS.md as an open deviation rather than silently fixed or silently dropped."

patterns-established:
  - "A closing-phase guard scans the SAME population its own siblings do (files[]-derived shipped modules via shipped-modules.ts, never a raw directory listing) and applies codeOnly() specifically to code, never to prose, so it can tell 'explains why not to' from 'does it'."

requirements-completed: [FORKRM-01, FORKRM-04, FORKRM-06, FORKRM-07]

coverage:
  - id: D1
    description: "docs-fork-absence.test.ts: committed, non-vacuous guard proving the removal stays removed"
    requirement: "FORKRM-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-absence.test.ts (all 13 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DENY_LIST/denyListRefusalMessage() confirmed gone from real shipped code; anno-tools.ts's allowlist confirmed unchanged"
    requirement: "FORKRM-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-absence.test.ts#2. no forbidden identifier appears as real code"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools-manifest.stock.json confirmed the only manifest; refresh-manifest.ts/tools-manifest.json confirmed gone"
    requirement: "FORKRM-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-absence.test.ts#5 and #6"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run test:automated at the documented 6-member floor, no live broker, no new/unexplained member"
    requirement: "FORKRM-07"
    verification:
      - kind: other
        ref: "npm run test:automated, /tmp/floor-52-10-final.log"
        status: pass
    human_judgment: false
  - id: D5
    description: "The nine rewritten skill fork-routing sites state a true, useful permanent-limitation sentence rather than merely omitting a tool"
    human_judgment: true
    rationale: "A grep can prove the phrase 'requires the fork' is absent; it cannot prove the replacement sentence is true and useful to a reader. This is the plan's own stated human check, carried into the phase's end-of-phase UAT batch per workflow.human_verify_mode."

# Metrics
duration: 55min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 10: Fork-Absence Guard and Phase Closure Summary

**Added `docs-fork-absence.test.ts` — a 13-test, non-vacuous, planted-violation-backed guard that fails the instant fork vocabulary, a second manifest, a deleted module or the missing acceptance record reappears — fixed two falsified fork-era symbol references in CLAUDE.md/PROJECT.md discovered along the way, and closed all seven Phase 52 requirements after reconciling each against the tree.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-12T10:20:00Z (approx.)
- **Completed:** 2026-09-12T11:15:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `src/mcp/vice/docs-fork-absence.test.ts` created: 13 tests, scanning the `files[]`-derived shipped module set (via `codeOnly()`-stripped text, so deliberate warning comments in `stock-recycle.ts`/`stock-dispatch.ts`/`stock-diagnose.ts`/`anno-tools.ts` are not mistaken for a reintroduction), every `src/skills/**/*.md` file, `README.md` and `CLAUDE.md`, for nine forbidden identifiers; asserts exactly one `tools-manifest*.json`; asserts six deleted modules absent from disk and `files[]`; asserts `docs/stock-hard-losses.md` present, non-vacuous, and cited by README. Carries a scanned-population floor (>= 95), non-empty identifier/module sets, and six planted-violation tests (real-predicate-driven, no fixture files). Deliberately excluded from `package.json`'s `files[]`; deliberately does not scan `.planning/**`.
- Repaired the orchestrator-handed defect: `probeBackend()` (deleted by plan 52-06; `resolvedBackend()` is the live route, 102 occurrences) removed from CLAUDE.md's and `.planning/PROJECT.md`'s byte-identical Constraints bullet, in one commit, per `docs-constraints-sync.test.ts`'s requirement.
- Discovered and repaired a SECOND instance of the same defect class: CLAUDE.md's separate Key Abstractions section still listed `DENY_LIST`/`denyListRefusalMessage()` (deleted by plan 52-05) as a live abstraction. Removed outright.
- Registered the new guard in `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` and its `audit-integrity.test.ts` mirror, closing a self-caused regression this plan discovered by running the full suite as Task 2 requires.
- Full verification battery run with no live broker: `npm run typecheck`, `npm run smoke`, `check-npm-packages.mjs`, `check-skill-capability-honesty.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-cli-invocations.mjs` all exit 0; `npm run test:automated` sits at the documented 6-member failure SET, unchanged member-for-member from before this plan.
- All seven `FORKRM-*` requirements reconciled against the tree with cited, runnable evidence and closed (`FORKRM-01`, `04`, `06`, `07` newly ticked; `02`, `03`, `05` were already Complete from earlier plans).

## Task Commits

1. **Task 1 (deviation, ahead of the guard): repair falsified `probeBackend()`/`DENY_LIST` references** — `4e276573` (fix)
2. **Task 1: add `docs-fork-absence.test.ts`** — `46dce620` (feat)
3. **Task 2 (deviation, discovered by running the battery): register the new guard in the docs-guard registry** — `38e3049d` (fix)
4. **Task 3: close `FORKRM-01/04/06/07` in `.planning/REQUIREMENTS.md`** — `d15a82f8` (docs)

_Task 2 itself (run the battery, record the floor) modified no files and produced no commit of its own — it is a verification-only task, per the plan's own `<files>` declaration ("none")._

## Files Created/Modified

- `src/mcp/vice/docs-fork-absence.test.ts` — the new deletion-stays-deleted guard (created)
- `CLAUDE.md` — `probeBackend()` clause fixed; stale `DENY_LIST` Key Abstractions bullet removed
- `.planning/PROJECT.md` — `probeBackend()` clause fixed (byte-identical Constraints copy)
- `scripts/audit-gate.mjs` — `docs-fork-absence.test.ts` registered in `EXPECTED_DOCS_GUARD_NAMES`
- `src/mcp/vice/audit-integrity.test.ts` — mirror registration of the same guard name
- `.planning/REQUIREMENTS.md` — `FORKRM-01/04/06/07` ticked, Traceability rows flipped to Complete

## Decisions Made

See `key-decisions` in the frontmatter above for full detail. Summary:

1. Fixed the handed defect (probeBackend) minimally, in both byte-identical Constraints copies, in one commit.
2. Fixed a second, self-discovered instance of the same defect class (CLAUDE.md's stale DENY_LIST Key Abstraction) — no PROJECT.md counterpart exists for that section, so only CLAUDE.md needed the edit.
3. Used `codeOnly()` stripping for the guard's shipped-module scan (not raw text) so it doesn't red on its own siblings' deliberate warning comments.
4. Registered the new guard in the docs-guard registry in the same commit that added it, closing a self-caused regression.
5. Reconciled criterion 1 against its literal wording (four named symbols + no fork transport import), not a bare grep for the substring "fork" — the one surviving real-code occurrence (`LegacyViceBackend`) is a deliberate, already-decided plan 52-07 invariant, not backend selection.
6. Found but did not fix a stale `vice-proxy.test.ts` residual (recorded to `.planning/WINDOWS.md` instead) — out of this plan's declared scope and already the manual-only file's known-broken disposition from earlier plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, handed by the orchestrator] Falsified `probeBackend()` reference in CLAUDE.md/.planning/PROJECT.md's Constraints**
- **Found during:** Pre-Task-1 investigation (flagged by the orchestrator before I started)
- **Issue:** Both byte-identical Constraints copies still named `probeBackend()` as the live probe for `x64sc`. Plan 52-06 deleted `probeBackend()` entirely; `resolvedBackend()` (102 occurrences) is the live detection route.
- **Fix:** `x64sc is probed by resolvedBackend() in backend-detect.mts` — the `/ probeBackend()` clause removed, both copies, one commit.
- **Files modified:** `CLAUDE.md`, `.planning/PROJECT.md`
- **Verification:** `grep -rn probeBackend src/ scripts/` → 0; `docs-constraints-sync.test.ts` green (byte-identity preserved).
- **Committed in:** `4e276573`

**2. [Rule 1 - Bug, self-discovered] A second falsified fork-era symbol reference in CLAUDE.md**
- **Found during:** Task 1, while designing `docs-fork-absence.test.ts`'s CLAUDE.md scan — the guard's own first run correctly caught this as a real failure before it was fixed.
- **Issue:** CLAUDE.md's Key Abstractions section (a block with no `.planning/PROJECT.md` counterpart) still listed `DENY_LIST` and `denyListRefusalMessage()` — both deleted by plan 52-05 along with `vice.ts` — as a current, live abstraction ("Hard-blocks specific tool names known to crash or bypass the...").
- **Fix:** Removed the 3-line stale entry outright. No speculative replacement was invented — there is no current 1:1 successor to a fork-era deny-list-shaped guard in this codebase.
- **Files modified:** `CLAUDE.md`
- **Verification:** `docs-fork-absence.test.ts`'s check 3 (README.md/CLAUDE.md scan) passes.
- **Committed in:** `4e276573`

**3. [Rule 3 - Blocking, self-caused] New guard not registered in the docs-guard registry**
- **Found during:** Task 2, running the full battery per the plan's own instruction
- **Issue:** Adding `docs-fork-absence.test.ts` without registering it in `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` (and its `audit-integrity.test.ts` mirror) reddened two registry-drift detectors that exist specifically to catch this omission — introducing two NEW failure-set members not in the documented floor.
- **Fix:** Registered `docs-fork-absence.test.ts` in both places, in one commit, per each file's own explicit instruction ("extend this array in the same commit as the new guard file").
- **Files modified:** `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts`
- **Verification:** `node --test audit-integrity.test.ts` — both registry-drift tests pass; `npm run test:automated` returns to the documented 6-member floor.
- **Committed in:** `38e3049d`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug, 1 Rule 3 blocking).
**Impact on plan:** All three were necessary for this plan's own guard and battery-measurement work to be truthful and green. No scope creep — the fixes are the minimum needed for the acceptance criteria to hold, not a broader cleanup pass.

## Closing Failure SET (Criterion 7)

Measured with `ps aux | grep -iE 'vice-broker|x64sc' | grep -v grep` returning no output (no live broker), all commands' exit codes captured on the same line (never piped):

```
typecheck=0
smoke=0
pkg=0 (check-npm-packages.mjs)
honesty=0 (check-skill-capability-honesty.mjs)
coverage=0 (check-skill-tool-coverage.mjs)
cli=0 (check-skill-cli-invocations.mjs)
SUITE_EXIT=1 (expected at the documented floor)
```

Sorted `not ok`/`✖` SET (6 members, exactly the documented floor, no new/unexplained member):

1. `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id`
2. `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md`
3. `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)`
4. `no milestone audit declares a gated status while any docs guard is red (D-12-02)`
5. `planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither`
6. `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates`

All six predate this phase (confirmed against the phase-entry 8-member baseline: this floor's 6, plus the two now-fixed `check-skill-fork-honesty`/`check-skill-tool-coverage` intermittent members, which plan 52-09 inverted and renamed to `check-skill-capability-honesty` and which the orchestrator's own measurement confirms now passes). This plan re-verified the set is unchanged rather than trusting the earlier measurement.

## Per-Criterion Evidence Table (Task 3)

| # | ROADMAP Criterion (paraphrased) | Evidence | Holds? |
|---|---|---|---|
| 1 | `VICE_BACKEND`/`probeBackend()`/`buildBackendAwareTool()` gone; no `backend === "fork"`; no fork transport import | `probeBackend`: 0 in `src/`, `scripts/`. `VICE_BACKEND`: 0 in shipped code. `buildBackendAwareTool`: 0. `backend === "fork"`: 0. `vice.ts` (the fork transport) absent from disk and `files[]`. One surviving real-code `"fork"` literal (`LegacyViceBackend` in `text-capability-probe.ts`) is a deliberate, documented plan 52-07 identity-mismatch invariant, not selection — does not violate the criterion's own wording. | **YES** |
| 2 | `FORK-01` row + Out of Scope bullet state the reversal; `docs-fork-decision.test.ts` rewritten | `docs-fork-decision.test.ts`: 7/7 pass. `FORK-01` row and Out of Scope bullet both read REVERSED, dated 2026-09-12, cross-consistent with the completed todo's SUPERSEDED block (re-read as part of this plan's human check). | **YES** (already Complete from plan 52-01) |
| 3 | Three hard losses ACCEPTED, dated, evidenced; not routed to the fork in skill text | `docs/stock-hard-losses.md` exists (3.4KB+), names SID/matrix/RESTORE with dates and evidence. `grep -raic fork src/skills --include='*.md'` → 0. `check-skill-capability-honesty.mjs` exits 0. | **YES** (already Complete from plan 52-01/52-03) |
| 4 | `DENY_LIST`/`denyListRefusalMessage()` gone with consumers; `anno-tools.ts` unchanged | `docs-fork-absence.test.ts`#2: 0 occurrences in `codeOnly()`-stripped shipped code. `anno-tools.ts`'s non-comment diff against pre-phase HEAD: 0 (confirmed by plan 52-05). Known residual: `vice-proxy.test.ts` (MANUAL_ONLY, excluded from `test:automated`) still has stale DENY_LIST-referencing structural tests that would throw if executed — recorded to `.planning/WINDOWS.md`, not fixed (out of scope, pre-existing since plan 52-04/06). | **YES** (criterion's own wording is about production consumers, all confirmed gone) |
| 5 | `capability-registry.ts` resolved by recorded decision | Absent from disk (confirmed). Decision recorded in plan 52-07's SUMMARY (deleted, six hardware entries migrated verbatim to `docs/stock-hard-losses.md`). | **YES** (already Complete from plan 52-07) |
| 6 | `tools-manifest.stock.json` only manifest; `refresh-manifest.ts`/`tools-manifest.json` gone | `ls tools-manifest*.json` → exactly `tools-manifest.stock.json`. `refresh-manifest.ts` absent from disk and `files[]`. `check-npm-packages.mjs` exits 0. | **YES** |
| 7 | `test:automated` green at documented floor, fork branches removed not skipped | See "Closing Failure SET" above: 6-member floor, unchanged, no live broker. | **YES** |

## Human Check (carried to end-of-phase UAT per `workflow.human_verify_mode: end-of-phase`)

**This plan is `autonomous: false` with no blocking checkpoint task — its one human check lives in `<verify><human-check>` and is surfaced here for the orchestrator's end-of-phase batch, per the plan's own instruction.**

### Check A: do the nine rewritten skill sites state what is unavailable and WHY, not merely omit a tool?

Three verbatim replacement sentences, quoted for direct judgment without opening files:

> `src/skills/c64-program-recon/references/control-flow.md:85-89`
> "experiment is not currently possible: **`vice_keyboard_restore` is permanently unavailable.** The RESTORE key pulses the NMI line directly and is not part of the keyboard matrix, so `KEYBOARD_FEED` (which only injects PETSCII text into the buffer) cannot produce it; calling the tool returns an error naming the reason, rather than pulsing RESTORE. No client-side substitute exists — see `docs/stock-hard-losses.md`. The reset half of the experiment remains testable: arm the checkpoint, call `vice_machine_reset` soft and hard, and record where the PC actually lands."

> `src/skills/c64-program-recon/references/observation-hazards.md:107-110`
> "**`vice_keyboard_matrix` is permanently unavailable.** The binary monitor's `KEYBOARD_FEED` (0x72) only injects PETSCII text into the KERNAL keyboard buffer; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix — this is unrecoverable, not merely unbuilt. See `docs/stock-hard-losses.md`. Use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or..."

> `src/skills/c64-ram-capture/SKILL.md:162-164`
> "Press past any \"hit any key\" gate. **`vice_keyboard_matrix` is permanently unavailable** — the binary monitor's `KEYBOARD_FEED` only injects PETSCII text into the KERNAL buffer and cannot drive the raw matrix; see `docs/stock-hard-losses.md`. Use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly; buffer injection stays invisible to a program polling `$DC00`/`$DC01` itself."

Each sentence names the tool, states it as permanently (not conditionally) unavailable, gives the hardware/protocol reason, and offers the available alternative or states plainly that none exists — this executor's own reading judges these as substantive rather than merely omitting a tool, but per the plan's own framing this is a human judgment call a grep cannot make on its own behalf.

### Check B: does `.planning/PROJECT.md`'s `FORK-01` row, its Out of Scope bullet, and the completed todo's SUPERSEDED block agree?

Re-read all three together as part of this plan:
- `FORK-01` Key Decisions row (`.planning/PROJECT.md:710`): states REVERSED, 2026-09-12, both original retain grounds withdrawn, re-reversal trigger restated (an explicit owner decision, not merely a landed `KEYBOARD_MATRIX_SET` opcode).
- `### Out of Scope` bullet (`.planning/PROJECT.md:438`): states the fork was removed 2026-09-12, cites the same date, cross-references `FORK-01` by name.
- Completed todo (`.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`): carries a SUPERSEDED block dated 2026-09-12, explicitly stating its own body's `retain` disposition is reversed and pointing to the live record.
- A fourth location checked incidentally (`.planning/PROJECT.md:1880-1889`, inside a `<details>`-collapsed "Previous milestone detail — archived" block) still describes the fork as "unchanged" — but this is explicitly labeled historical/archived narrative, not presented as current truth, and does not contradict the three live sources above.

**No contradiction found between the three living sources.** This executor's own reading is that the `retain` disposition no longer reads as the current answer anywhere it should not. Surfaced here per the plan's instruction for the human to confirm independently.

## Known Residuals (not fixed by this plan, disclosed rather than silently dropped)

- **`vice-proxy.test.ts`'s stale `DENY_LIST` structural tests** (e.g. `"structural: the refusal set and the annotation set are disjoint"`, which does `readFileSync(join(HERE, "vice.ts"), "utf8")` — `vice.ts` no longer exists and this would throw ENOENT if the test ever ran). The file is a `MANUAL_ONLY_TESTS` entry (never run by `npm run test:automated`), was already partially repaired by plan 52-06 for its fork/`VICE_BACKEND` scaffolding, but this specific DENY_LIST-dependent test slipped through. Out of this plan's `files_modified`; recorded to `.planning/WINDOWS.md` (deviation, phase 52, open) rather than fixed or silently ignored.
- **`broker-launch.mts`'s dead fork-argv code paths** (`buildViceArgs()`'s trailing `return ["-mcpserver", ...]`, `probeReady()`'s HTTP-probe else-branch) — confirmed still present, exactly as plan 52-06's SUMMARY flagged them as a deliberate residual (judged out of that plan's scope, lower-risk left in place than restructuring a crash-supervision-adjacent function). Still dead code, still untested, still not this plan's scope to remove.
- **`docs/stock-vice-parity.md`'s historical `Phase 3`/`4`/`5`/`7`/`8` prose** — confirmed still present. `skills-planning-vocabulary.test.ts` only polices `src/skills/**`, so `docs/` is not mechanically enforced. Noted per the orchestrator's instruction, not fixed — no plan in this phase declared it in scope.

## Issues Encountered

None beyond the three deviations documented above, all resolved within this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 52 (Remove the Fork Backend) is now 10/10 plans executed, all seven `FORKRM-*` requirements Complete.
- `docs-fork-absence.test.ts` stands as a permanent regression guard: any future reintroduction of fork vocabulary, a second manifest, a deleted module, or loss of the acceptance record will fail this guard immediately, both in `npm run test:automated` and via the docs-guard registry's own drift detectors.
- The three known residuals above (vice-proxy.test.ts staleness, broker-launch.mts dead code, stock-vice-parity.md phase prose) are disclosed, not blocking, and available for a future cleanup pass if desired — none affects a Phase 52 requirement or the automated floor.
- The human check above (skill-sentence quality; PROJECT.md/todo consistency) is ready for the orchestrator's end-of-phase UAT batch.

## Self-Check: PASSED

- `test -f src/mcp/vice/docs-fork-absence.test.ts` → FOUND.
- `git ls-files -- src/mcp/vice/docs-fork-absence.test.ts | wc -l` → `1` (tracked).
- `python3 -c "import json; print('docs-fork-absence.test.ts' in json.load(open('src/mcp/vice/package.json'))['files'])"` → `False` (correctly excluded from `files[]`).
- All four commit hashes verified present: `git log --oneline --all | grep -E '4e276573|46dce620|38e3049d|d15a82f8'` returns all four.
- `node --test docs-fork-absence.test.ts docs-fork-decision.test.ts docs-constraints-sync.test.ts` (run from `src/mcp/vice`): 28/28 pass.
- `npm run typecheck` exits 0 (re-confirmed as the final action before writing this SUMMARY).
- `.planning/REQUIREMENTS.md`: `FORKRM-01..07` all `[x]` and all Traceability rows `Complete`; `grep -ac 'FORKRM-0[1-7]' .planning/REQUIREMENTS.md` → 15, matching the pre-edit line count exactly (no rows added or removed, only checkbox/status text changed).
- `npm run test:automated` failure SET (final re-run): exactly the 6 documented members, no new/unexplained member, no live broker running.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
