---
phase: 12-audit-integrity-instrument
plan: 05
subsystem: infra
tags: [audit-gate, regex-dos, hook, bash, gsd-security]

requires:
  - phase: 12-audit-integrity-instrument (plan 12-02/12-03/12-04)
    provides: "the --hook PreToolUse extension of audit-gate.mjs, live-wired via .claude/settings.json, and the review/verification reports that found CR-01/CR-03/WR-04"
provides:
  - "A bounded, non-backtracking milestone-audit token locator (auditTokenOffsets/textNamesMilestoneAudit) shared by all three text-scan call sites"
  - "An unanchored gated-status scan for Bash command text (declaresGatedStatusUnanchored), derived from the single GATED_STATUSES set"
  - "Two committed wall-clock ceiling tests and seven committed CR-03 tests in audit-integrity.test.ts"
  - "A dated amendment section in 12-GATE-PROOF.md correcting its superseded detection-contract description"
affects: [12-06, 12-07, 15]

actuals:
  tokens: 8160
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Bounded-window text scanning: locate a literal token with indexOf (linear, non-backtracking) across the FULL input, then apply small fixed-length-window regexes only around each hit -- full coverage, constant-cost regex evaluation, no global input cap (a cap is a bypass)."

key-files:
  created: []
  modified:
    - scripts/audit-gate.mjs
    - .claude/mcp/vice/audit-integrity.test.ts
    - .planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md

key-decisions:
  - "Windowed token-adjacency scan (512-char writer window, 4096-char in-place-edit window) chosen over a global input-length cap, because a cap is a bypass -- placing the write past the cut point makes the gate blind to it, whereas bounding only the regex work around each located token preserves full-length coverage."
  - "The structured Write/Edit document-content branch keeps writtenDeclaresGatedStatus()'s line-anchored scan unchanged; only the Bash branch and the unrecognised-shape/malformed-JSON fallbacks gained the unanchored scan -- preserves the T-12-04 false-positive defence for milestone-audit prose while closing CR-03 for command text."

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "CR-01 closed: no input length or shape makes --hook target detection super-linear"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a large benign `sed -i` command is evaluated in bounded time (CR-01, regex backtracking)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a large unrecognised-shape payload is evaluated in bounded time (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CR-03 closed: all four single-line Bash write shapes (echo, printf, tee -a, one-line sed -i) carrying a gated status into a milestone audit are refused"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash echo append of a gated status into a milestone audit is blocked (CR-03, D-12-04)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash printf append of a gated status into a milestone audit is blocked (CR-03, D-12-04)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash `tee -a` append of a gated status into a milestone audit is blocked (CR-03, D-12-04)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash `sed -i` substitution writing a gated status into a milestone audit is blocked (CR-03, D-12-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12-12/D-12-13 preserved: one gated-status value set (GATED_STATUSES), status: gaps_found never gated in any of the four Bash shapes, an Edit downgrade never blocked"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash echo append of status: gaps_found is never blocked (D-12-13)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash printf append of status: gaps_found is never blocked (D-12-13)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash `tee -a` append of status: gaps_found is never blocked (D-12-13)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a one-line Bash `sed -i` substitution writing status: gaps_found is never blocked (D-12-13)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: an Edit downgrading passed to gaps_found is never blocked (D-12-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-04 closed: the dead pathish push is gone; every comment in scripts/audit-gate.mjs describes the code as it now is"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep -c 'pathish.push' scripts/audit-gate.mjs == 1"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts (full suite, 38/38) -- deleting the dead push changed no behaviour"
        status: pass
    human_judgment: true
    rationale: "The comment-accuracy sweep (header HOOK MODE paragraph, WHAT NOT TO DO list, collectStringLeaves(), rawTextIndicatesScope()) was verified by grep for the removed identifiers plus a manual line-by-line review of every surviving 'line-anchored' occurrence (recorded below), which is a judgment call about prose accuracy that no automated check fully proves."
  - id: D5
    description: "D-12-14 preserved: no waiver file, no environment-variable hatch, no skip flag; exactly one environment read remains in the file"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep -v '^\\s*//' scripts/audit-gate.mjs | grep -c 'process.env' == 1"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-21
status: complete
---

# Phase 12 Plan 05: Bounded token locator plus unanchored Bash gated-status scan Summary

**Replaced two super-linear regexes in `scripts/audit-gate.mjs`'s `--hook` Bash detection path with a linear indexOf-based token locator and bounded-window scans, closing a live denial-of-service (CR-01) and the single-line Bash-append gate bypass (CR-03) that plan 12-02 claimed to close but did not.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-21T17:42:15Z (base commit 3e9c3c8)
- **Completed:** 2026-08-21T18:04:24Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **CR-01 closed.** `BASH_ADJACENT_WRITE_RE`/`BASH_INPLACE_EDIT_RE`'s unbounded `[\s\S]*?` bridge and the whole-text `MILESTONE_AUDIT_TOKEN_RE` are gone. `auditTokenOffsets()` locates the literal `MILESTONE-AUDIT` token with `String.prototype.indexOf` (linear, non-backtracking, capped at 64 occurrences), then `bashTargetsMilestoneAudit()`/`textNamesMilestoneAudit()` apply only small fixed-length-window regexes (256/512/4096 chars) around each hit. Measured: a 100,000-char `sed -i ` command dropped from 7,050 ms (regex alone, pre-fix) to ~44 ms (whole `--hook` CLI round trip, post-fix); a 100,000-char unrecognised-shape payload dropped from 5,353 ms to ~45 ms.
- **CR-03 closed.** `declaresGatedStatusUnanchored()`, built from the same `GATED_STATUSES` set `isGatedStatus()` uses, replaces the line-anchored `writtenDeclaresGatedStatus()` in the Bash branch of `isHookInScope()`. All four single-line Bash write shapes (`echo`, `printf`, `tee -a`, one-line `sed -i`) that carry a gated status into a milestone audit are now refused; `status: gaps_found` in any of the four shapes, and a gated append to a non-audit path, are still never blocked.
- **WR-04 closed.** The dead `toolName === "Bash"` push into `pathish` inside `extractHookTarget()` is removed (it was unreachable -- `isHookInScope()` never reads `pathish` for Bash). The `HOOK_PATH_KEYS` comment, the header's HOOK MODE paragraph, the WHAT NOT TO DO list, and the `collectStringLeaves()`/`rawTextIndicatesScope()` comments are all corrected to describe the code as it now stands.
- **`12-GATE-PROOF.md` amended.** A dated "Detection contract amended by gap closure" section records what the plan-12-02-era transcript described, what replaced it, why (CR-01/CR-03, measured numbers), and that T-12-02's base64/`python -c` limitation is unaffected. The original transcript paragraph is left as a historical record.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bounded, non-backtracking milestone-audit token locator (CR-01)** - `6035d6e` (fix)
2. **Task 2: Unanchored gated-status scan for Bash command text (CR-03)** - `850d5aa` (fix)
3. **Task 3: Remove dead Bash pathish push and reconcile comments (WR-04)** - `d6be09a` (fix)

_TDD note: Task 1/2 carried `tdd="true"` at the task level, but this plan's `type: execute` frontmatter (not `type: tdd`) does not invoke the plan-level RED-commit/GREEN-commit gate. The plan's own `<action>`/`<acceptance_criteria>` instead prescribed a revert-and-rerun fail-first proof (see below), which was followed exactly as written -- one commit per task, each preceded by a red reproduction against the pre-fix source._

## Files Created/Modified

- `scripts/audit-gate.mjs` - Bounded token locator (`auditTokenOffsets`, `textNamesMilestoneAudit`), rewritten `bashTargetsMilestoneAudit()`, new unanchored gated-status scan (`declaresGatedStatusUnanchored`/`BASH_GATED_STATUS_RE`), dead-code removal, and a full header/comment sweep
- `.claude/mcp/vice/audit-integrity.test.ts` - 2 CR-01 ceiling tests, 4 CR-03 blocked-shape tests, 4 D-12-13 negative-control tests, 1 non-audit-path test (11 new tests total)
- `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` - Dated amendment section correcting the superseded Bash-detection-contract description

**Test count:** 27 (pre-existing) + 2 (Task 1 ceiling tests) + 9 (Task 2: 4 blocked shapes + 4 gaps_found negatives + 1 non-audit-path) = 38 tests, 0 fail, matching the plan's "at least 36" floor with margin.

## Red-Then-Green Reproductions (fail-first proof)

Each defect was seen red against the pre-fix source (by temporarily replacing `scripts/audit-gate.mjs` with `git show HEAD:scripts/audit-gate.mjs` -- the last-committed state before that task's fix -- running the new tests, then restoring the fixed source; no `git stash`, `git checkout --`, or other working-tree-wide reset was used) and green after:

| Defect | Pre-fix (red) | Post-fix (green) |
|---|---|---|
| CR-01, `sed -i` ceiling test | 7,046 ms (measured) — exceeds 2000 ms, matches the plan's ~7,050 ms baseline | 44.7 ms |
| CR-01, unrecognised-shape ceiling test | 4,935 ms (measured) — exceeds 2000 ms, matches the plan's ~5,353 ms baseline | ~45 ms |
| CR-03, all four blocked Bash shapes (echo, printf, tee -a, one-line sed -i) | 4/4 tests failed (exit 0 observed where exit 2 was asserted) | 38/38 tests pass |

## Decisions Made

- Bounded WINDOWS (512-char writer-adjacency, 4096-char in-place-edit presence, 256-char audit-token-tail) around each `indexOf`-located token, rather than a single global input-length cap. A global cap is a bypass -- the write moves past the cut point and the gate never sees it -- whereas locating the token first across the full input and bounding only the surrounding regex work preserves full-length coverage.
- The structured `Write`/`Edit` document-content branch of `isHookInScope()` keeps `writtenDeclaresGatedStatus()`'s line-anchored scan unchanged. Only the Bash branch and the unrecognised-shape/malformed-JSON fallbacks gained `declaresGatedStatusUnanchored()`. This preserves T-12-04's measured false-positive defence (a milestone-audit document's own prose legitimately contains `status: passed` while its frontmatter declares something else -- `12-VERIFICATION.md` in this phase directory is a real example) while closing CR-03 for command text, which has no comparable multi-line-prose risk.
- Accepted new limitation T-12-20: an in-place edit whose script argument exceeds the 4096-character left window is no longer detected. Recorded in the code comment on `bashTargetsMilestoneAudit()`, in this SUMMARY, and in the `12-GATE-PROOF.md` amendment. A 3,000-character `sed -i` script is still detected (measured); realistic in-place edits are far below the window; Layer 1 (`checkAuditGate()`, re-reading the actual committed file content) still catches the landed write regardless of how the shell wrote it.
- T-12-19 (base64/`python -c` obfuscation, carried forward unchanged from plan 12-02) and T-12-20 (the new 4096-char in-place window) are both **accepted limitations**, not resolved defects -- this plan does not claim the Bash hook is now a complete parser. The hook remains a fast, in-session deterrent; Layer 1 is the unevadable enforcement point.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<action>` blocks specified exact constant names (`AUDIT_TOKEN`, `MAX_AUDIT_TOKEN_SCANS`, `AUDIT_TOKEN_TAIL_WINDOW`, `AUDIT_TOKEN_TAIL_RE`, `BASH_WRITER_WINDOW`, `BASH_WRITER_TAIL_RE`, `BASH_INPLACE_WINDOW`, `BASH_INPLACE_PRESENCE_RE`, `BASH_GATED_STATUS_RE`, `auditTokenOffsets`, `textNamesMilestoneAudit`, `declaresGatedStatusUnanchored`) and every one was implemented under exactly that name with the specified semantics (start-anchored tail regex, end-anchored writer regex, unanchored presence regex). No exported name was renamed or re-derived (`docsGuardFiles`, `runGuardsLive`, `frontmatterStatus`, `isGatedStatus`, `milestoneAuditFiles`, `checkAuditGate`, `writtenDeclaresGatedStatus`, `extractHookTarget`, `isHookInScope`, `DOCS_GUARD_FLOOR`, `EXPECTED_DOCS_GUARD_NAMES` all confirmed unchanged by `grep -n '^export '`).

## `line-anchored` comment review (Task 3 acceptance criterion)

Every surviving occurrence of the string `line-anchored` in `scripts/audit-gate.mjs` was reviewed line by line, none asserts that a Bash command's gated status is found by a line-anchored scan:

- `writtenDeclaresGatedStatus()`'s own docstring (~line 203 area referenced from `BASH_GATED_STATUS_RE`'s comment) -- contrasts the Bash/unrecognised-shape scan (unanchored) against `writtenDeclaresGatedStatus()` staying line-anchored for structured document content; correctly attributes the line-anchored scan to document content, not Bash.
- `collectStringLeaves()`'s docstring (two occurrences) -- explains the newline-join is preserved for the fallback's line-anchored half, and explicitly states the unanchored scan is also tried on the same joined text; does not claim line-anchored is the only or primary scan.
- `writtenDeclaresGatedStatus()`'s own docstring's T-12-04 paragraph -- names the measured false-positive trap the line-anchored scan exists to keep closed for document content (`12-VERIFICATION.md` cited as the live example).
- `rawTextIndicatesScope()`'s docstring -- explains why the escape-decode step matters for the line-anchored half specifically, then states the unanchored scan is also tried on the decoded text.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 12-06 (wave 6, depends on this plan) closes CR-02 (`collectStringLeaves()`'s unbounded recursion) next; it is unaffected by this plan's changes since CR-02 is a separate defect in a different function.
- Plan 12-07 will finalize `12-GATE-PROOF.md`/`12-HOOK-STDIN-EVIDENCE.md` once all gap-closure plans land; this plan's amendment section is additive and does not need further editing by 12-07 unless a subsequent plan further changes the Bash detection contract.
- No blockers. The real tree remains green (`node scripts/audit-gate.mjs` prints `audit-gate: OK`, all 4 docs guards pass) throughout this plan's execution.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*

## Self-Check: PASSED

- All four modified/created files confirmed present on disk (`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`, `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md`, this SUMMARY).
- All three task commits (`6035d6e`, `850d5aa`, `d6be09a`) confirmed present via `git log --oneline --all`.
- Re-ran `node --test audit-integrity.test.ts` (38/38 pass) and the four `docs-*.test.ts` guards (57/57 pass total) immediately before writing this SUMMARY.
- Re-ran `node scripts/audit-gate.mjs` on the real tree: `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`, exit 0.
- Re-ran `npm run typecheck` in `.claude/mcp/vice`: clean.
