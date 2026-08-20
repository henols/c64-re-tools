---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 09
subsystem: testing
tags: [regenerator2000, annotation-store, falsifiability, r2000-tools, two-session-proof]

# Dependency graph
requires:
  - phase: 11-07
    provides: "evidence/criterion1/QUESTION.md (the sealed question), ANSWER.md/ANSWER.sha256 (the sealed key), recon-subject.regen2000proj (the annotated store) -- session A's committed artifacts, read only through the two permitted files"
  - phase: 11-05
    provides: "runR2000Tool()/CURATED_R2000_TOOLS/resolveStorePath() in r2000-tools.ts -- the ONE dispatcher this plan's driver script calls to query the store"
provides:
  - "SESSION-B-ANSWER.md: an independent execution context's answer to criterion 1's sealed question, derived entirely from r2000_* tool calls, with per-field call/response derivation and a files-read list"
  - "A mechanical seal comparison extending r2000-answer-key.test.ts: session B's canonical line hashes and is asserted equal to the sealed ANSWER.sha256"
  - "A live, non-vacuity-proven verdict: MATCH -- both hashes are e64463d8cef8fbb7699620a3c207de08a36b1189afd9700452a448d91d8c08cc"
affects: [11-10, 11-11, 11-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Driving runR2000Tool() directly from a standalone Node script (rather than through a live MCP tool-call transport) when the executing session has no r2000_* tools wired into its own tool set -- the dispatcher and its guards (assertCuratedTool(), resolveStorePath()) are identical either way, so this is a legitimate query route, not a workaround that bypasses the curated surface"
    - "Session-boundary falsifiability proof: a second execution context, given only the sealed question and the committed store, is checked mechanically (sha256 equality) against a key sealed before that context existed -- extending the SAME test file (r2000-answer-key.test.ts) rather than adding a parallel checker, so seal-drift and vacuous-check guards stay in one place"

key-files:
  created:
    - .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/SESSION-B-ANSWER.md
  modified:
    - .claude/mcp/vice/r2000-answer-key.test.ts

key-decisions:
  - "Queried the store via a Node driver script importing runR2000Tool() directly, rather than through a live MCP session, because this execution context has no r2000_* tools registered in its own tool set -- documented explicitly in SESSION-B-ANSWER.md's derivation section as an implementation detail that does not change which function was called or which guards ran"
  - "The two new tests use a bare readFileSync + extractCanonicalLine() call with no existsSync guard and no try/catch, so a missing SESSION-B-ANSWER.md or an empty fenced block surfaces as a FAILING assertion rather than a skip -- proven live by deliberately emptying the fenced block, observing both new tests fail (not skip), then restoring the file from a backup and confirming git diff was clean before re-committing"
  - "The verdict is MATCH, recorded honestly with both explicit hash values rather than just 'the test passed' -- the store genuinely carried Session A's human judgements (a label name, a confidence grade, a reachability-based block classification) across the session boundary, verified mechanically rather than asserted"

requirements-completed: [R2000-10, R2000-11]

# Metrics
duration: 20min
completed: 2026-08-21
---

# Phase 11 Plan 09: Session B — Answering Criterion 1's Sealed Question From the Store Summary

**A second, independent execution context answered all four parts of criterion 1's sealed D-26 question using only `r2000_*` queries against the committed annotation store, and its answer's sha256 matched the sealed `ANSWER.sha256` exactly — the two-session falsifiability proof returned MATCH.**

## Performance

- **Duration:** ~20 min (estimated from git commit timestamps; PLAN_START_TIME was not captured at kickoff)
- **Started:** 2026-08-21T00:59:xx+02:00 (approx., immediately after the worktree base-correction reset)
- **Completed:** 2026-08-21T01:08:49+02:00
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Answered `QUESTION.md`'s four parts entirely from the store, via four `r2000_*` calls (`r2000_get_symbols`, `r2000_get_comments`, `r2000_get_blocks`, `r2000_get_cross_references`), each recorded with its exact arguments and response fragment in `SESSION-B-ANSWER.md`.
- Canonical answer line: `label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2` — validated against `QUESTION.md`'s own grammar regex before being sealed into the derivation.
- Extended `r2000-answer-key.test.ts` (from plan 11-07) with a session-B comparison test and a grammar-conformance test, keeping all of 11-07's original seal-drift and leak-detection assertions intact (7/7 pass).
- Proved the new tests are non-vacuous: emptied `SESSION-B-ANSWER.md`'s fenced canonical block, re-ran the suite, and confirmed both new tests FAIL (not skip) with an assertion error naming the empty fence — then restored the file from a pre-corruption backup and confirmed `git diff` was byte-clean before re-committing.
- Recorded the verdict in `SESSION-B-ANSWER.md`: **MATCH** — session B's recomputed sha256 (`e64463d8...`) equals the sealed `ANSWER.sha256` exactly. `ANSWER.md`, `ANSWER.sha256` and `QUESTION.md` are confirmed unmodified (`git diff --exit-code` clean on all three, both before and after Task 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: answer the question from the store, recording every call** - `ad86666` (feat)
2. **Task 2: compare against the sealed key and record the verdict honestly** - `8f33770` (test)

## Files Created/Modified

- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/SESSION-B-ANSWER.md` - Canonical answer line, per-field derivation (call + response fragment), files-read list, store-completeness note, and the final Verdict section (both hashes, MATCH)
- `.claude/mcp/vice/r2000-answer-key.test.ts` - Two new tests: session-B canonical line hashes to the sealed `ANSWER.sha256`; session-B's canonical line matches `QUESTION.md`'s grammar. Original 5 tests (T-11-SEAL-DRIFT, T-11-LEAK) untouched.

## Decisions Made

- Drove the curated `r2000_*` surface via a standalone Node script importing `runR2000Tool()` directly (`/tmp/.../scratchpad/session-b-query.mts`, not committed — a throwaway driver, not a deliverable), since this execution context has no live MCP connection exposing `r2000_*` tools as callable tools in its own tool set. This calls the exact same dispatcher function (`runR2000Tool()`) with the exact same guards (`assertCuratedTool()`, `resolveStorePath()`) that `vice-proxy.ts` would use for a real MCP `tools/call` — documented explicitly in `SESSION-B-ANSWER.md` so the derivation's evidentiary weight is stated honestly rather than implied to be a live MCP session.
- Kept the seal-comparison logic inside the existing `r2000-answer-key.test.ts` rather than adding a second test file, per the plan's explicit instruction ("extend that file rather than adding a second seal test") and this project's one-authoritative-place convention.
- Verified the non-vacuity requirement live rather than by inspection: corrupted the fenced block, watched both new tests fail with a specific assertion message, then reverted — matching `ENGINEERING_RULES.md` §6's "observed failing under a planted violation" bar.

## Deviations from Plan

None — plan executed exactly as written. `node_modules/` was not present in this worktree at session start (documented, pre-provisioned via the `SessionStart` hook that this on-demand `Bash` session did not run); `npm ci` was run manually inside `.claude/mcp/vice` before any test/typecheck command, matching 11-05's own noted issue. This is setup, not a deviation from plan scope.

## Issues Encountered

- **Worktree base was stale at spawn** (the known repo quirk documented in this plan's `<worktree_branch_check>`): HEAD started at `5117c60` (pre-Phase-11), not the expected `0d41cc4` (Phase 11 wave 4 tip). Corrected with `git reset --hard 0d41cc4dde6c419684be815479dff1746156b5c7` before any read or edit, per the documented recovery procedure. Verified both required evidence artifacts (`recon-subject.regen2000proj`, `QUESTION.md`) existed after the reset.
- **Pre-existing, unrelated to this plan:** `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test fails inside this worktree (checkout lives under `.claude/worktrees/<id>/`, which the test asserts is NOT the case) — the same documented worktree-only artifact noted in this plan's `prior_wave_context` and in 11-05-SUMMARY.md. `npm run test:automated` returned 1875 pass / 1 fail (this one) / 5 todo, unchanged by this plan's own changes. `npm run typecheck` is clean.
- Calling `runR2000Tool()` for the first time in this worktree triggered `install-resources.ts`'s one-time host-launcher deployment into `tools/` (an unrelated, pre-existing side effect of `repoRoot()`'s first call). Confirmed harmless: `tools/*.mjs` and `vice-launcher.sh` are gitignored (`.gitignore:30`), and `git status --short` showed no changes from it.

## User Setup Required

None — no external service configuration required. `regenerator2000 0.9.20` was already installed on this host (`~/.cargo/bin/regenerator2000`), confirmed via `--version` before querying.

## Files Read This Session (auditability of the session-boundary claim)

Full list is recorded in `SESSION-B-ANSWER.md` itself (the artifact whose purpose is exactly this audit trail). Summary: the plan file, `QUESTION.md`, the five required initial-context files (`PROJECT.md`, `ARCHITECTURE.md`, `ENGINEERING_RULES.md`, `STATE.md`, `CLAUDE.md`), `11-05-SUMMARY.md` (explicitly permitted), `r2000-tools.ts`, `r2000-cli.ts`, and `r2000-answer-key.test.ts` (both named in the plan's own `read_first` blocks). None of the eight forbidden files were read, and no `git log -p`/`git show`/`git log` was run over plan 11-07's commits. `recon-subject.regen2000proj` was never opened as text — every value in the answer came from an `r2000_*` tool-call response.

## Next Phase Readiness

- Criterion 1's two-session falsifiability proof is closed with a genuine, mechanically-verified MATCH — not asserted, not retro-fitted. `ANSWER.md`/`ANSWER.sha256`/`QUESTION.md` remain exactly as plan 11-07 sealed them.
- No blockers for 11-10/11-11/11-12. The `r2000-answer-key.test.ts` file now carries 7 tests (5 from 11-07, 2 from this plan) and stays TEST-ONLY (not in `package.json`'s `files[]`).

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/SESSION-B-ANSWER.md
- FOUND: .claude/mcp/vice/r2000-answer-key.test.ts
- FOUND commit: ad86666 (feat(11-09): session B answers criterion 1's sealed question from the store)
- FOUND commit: 8f33770 (test(11-09): compare session B's answer to the sealed key and record MATCH)
