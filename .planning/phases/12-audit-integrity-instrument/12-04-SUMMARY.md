---
phase: 12-audit-integrity-instrument
plan: 04
subsystem: ci-gates
tags: [gate-01, audit-integrity, real-tree-proof, evidence]

# Dependency graph
requires: ["12-01", "12-02", "12-03"]
provides:
  - ".planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md: the one-time real-tree red-then-green plant-and-revert transcript satisfying GATE-01's criteria 1 and 2, with criterion 3's checkAuditGate() citation in its closing section"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A documentation-only, single-digit plant (a citation number, not product code) is the cheapest possible real-tree red-guard fixture -- reverting it is a one-character undo with zero risk to shipped behaviour (D-12-18)"
    - "Payloads for a live hook probe are always built inside Node and piped via stdin, never assembled as a literal Bash string, so the executor's own tool call cannot trip the hook it is trying to observe"

key-files:
  created:
    - .planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md
  modified: []

key-decisions:
  - "Confirmed directly against the real tree (not assumed) that gating status: tech_debt alongside status: passed is deliberately stricter than GATE-01's literal wording, per D-12-12: both statuses route to /gsd-complete-milestone, so both must be blocked while a docs guard is red. gaps_found is never gated (D-12-13), shown live in the transcript's section 5 (two gaps_found rounds present in auditFiles, absent from gatedAudits, even while red). Recorded plainly so the milestone audit reads this as intentional scope, not drift."
  - "The Bash-mode content-adjacency scan (plan 12-02) is a heuristic, not a shell parser, and is evadable by a base64 or python -c payload assembled at runtime (T-12-02, accepted, carried forward unchanged). Stated plainly in the transcript's closing section rather than implied away -- Layer 1 (audit-integrity.test.ts driving checkAuditGate(), which re-reads the actual committed file) is the unevadable enforcement point, not the hook."
  - "parseRedGuardNames()'s documented fallback (list every guard file when no per-file not ok line is found in the TAP stream) fired during this real-tree run -- node --test's multi-file invocation surfaces individual test names, not file-wrapper names, so the primary parse found nothing and all four guard files were named in the refusal rather than only docs-linerefs.test.ts. Recorded as expected fallback behaviour, not a defect: docs-linerefs.test.ts is still present in the listed set, satisfying the acceptance criterion."
  - "2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md was confirmed still Pending and left untouched -- CI's test command (npm test, the full *.test.* glob) is unchanged by this plan, exactly as scoped."

patterns-established: []

requirements-completed: [GATE-01]

# Metrics
duration: ~35min
completed: 2026-08-21
---

# Phase 12 Plan 04: Real-tree GATE-01 plant-and-revert proof Summary

**A committed transcript now shows the actual `scripts/audit-gate.mjs` mechanism refusing (exit 1, `--hook` exit 2) the audit-`passed`/`tech_debt` path against this repository's real tree while `docs-linerefs.test.ts` is genuinely red from a one-digit `CLAUDE.md` citation plant, then allowing it again after an exact, mechanically-verified revert — with `gaps_found` shown passing through unobstructed throughout.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 1
- **Files created:** 1 (`.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md`, 389 lines)

## Accomplishments

- Planted a single-character change on the real, uncommitted `CLAUDE.md` (`vice-proxy.ts:3029` → `:3030` in the Architecture bullet, line 26), confirmed by `git diff --stat` (1 file, 1 line) and the full diff hunk to be exactly one digit and nothing else.
- Captured `docs-linerefs.test.ts` going genuinely red (2 pass / 1 fail), quoting its own failing assertion text naming the bad line verbatim (`"    translatedArgs = rewritten.args;"`).
- Captured `node scripts/audit-gate.mjs` refusing from the repo root (exit 1), naming all three D-12-15 refusal parts, and naming `v0.3.0-MILESTONE-AUDIT.md` (`status: passed`) plus three `tech_debt` files as real, gated-and-refused audits — real-tree evidence for both gated statuses (D-12-12).
- Captured the `--json` form and, from it, confirmed the two `gaps_found` rounds (`v0.2.0-MILESTONE-AUDIT-round2/round3-2026-08-19.md`) are present in `auditFiles` but absent from `gatedAudits`, even while the guard is red (D-12-13, live, not asserted).
- Captured `audit-integrity.test.ts`'s Layer 1 going red on exactly its expected real-tree test (D-12-02, test 4 of 27), with the planted-violation/planted-false-negative synthetic-tree pair (D-12-16) still green throughout, proving the permanent and one-time proofs agree.
- Built a `--hook`-mode payload entirely inside a `node -e` one-liner (never a literal Bash string, per this plan's hazard 1) and piped it to `--hook --root <repo-root>` against the real, red tree: exit code `2`, the sole blocking mechanism.
- Reverted the digit, confirmed byte-identical via `git diff --quiet CLAUDE.md` (empty) and `git status --porcelain` (empty), then captured the guard's own green output again (3/3 pass), `audit-gate: OK` (exit 0), a full clean `npm test` (2194 pass / 0 fail), and a clean `check-npm-packages.mjs` run.
- Closing section of the artifact cites `checkAuditGate()` at `scripts/audit-gate.mjs:298` and the `.claude/settings.json` `PreToolUse` entry that invokes it (criterion 3), states the `tech_debt` strictness decision, states the Bash-evasion limitation (T-12-02) plainly, and defers the live in-session hook block to the plan's end-of-phase human check (since this session predates the settings.json wiring being loaded).

## Task Commits

1. **Task 1: Run the real-tree plant-and-revert and capture every output** - `16d5ed6` (docs)

## Files Created/Modified

- `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` - The full red-then-green real-tree transcript: baseline, plant, guard-red, mechanism-refuses, gaps_found-unobstructed, Layer-1-red, hook-path-refuses, revert, green-again, and a closing "what this does and does not prove" section.

## Decisions Made

See `key-decisions` in frontmatter. Summary: `tech_debt` gating is deliberate and stated as such (not scope drift); the Bash-scan evasion limitation is stated plainly rather than implied away; the observed `parseRedGuardNames()` fallback (all four guards named, not just the one actually red) is documented as expected mechanism behaviour; the CI-test-command todo was confirmed still pending and untouched.

## Deviations from Plan

### Auto-fixed Issues

None — no code was modified by this plan; it is a pure evidence-capture task against already-shipped mechanism code from plans 12-01/12-02/12-03.

**Observed, not a deviation:** one `npm test` run performed concurrently with a diagnostic `grep` pipeline (while investigating how to extract a failing-test name from truncated output) reported a transient `# fail 1` with no failing test name visible in the truncated tail — caused by two `node --test` invocations contending for this repo's shared broker/pool state, not by the plant or revert. Re-run in isolation immediately after: clean `2194 pass / 0 fail`. Recorded in the transcript's Section 9 rather than omitted, per this plan's own evidentiary standard.

No other deviations — the plan executed exactly as written, including the mandatory hazard-1 Write-tool-only artifact creation and the hazard-2 revert-before-any-`git add` sequencing.

## Threat Flags

None — this plan introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. It captures evidence of already-shipped mechanism behaviour (plans 12-01/12-02/12-03) against the real tree, then reverts its own plant.

## Verification Evidence

- `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md`: 389 lines (≥ 90 required); frontmatter carries `outcome: red-then-green`, `guard: docs-linerefs.test.ts`, `reverted: true`, `criteria: [1, 2]`, `date: 2026-08-21`, `sha: f22cfc3c2926fc430324f9b2499fd4ce69020020`.
- 36 fenced transcript blocks (≥ 8 required); 23 lines beginning with `$ ` (≥ 8 required).
- `audit-gate: REFUSED` and `audit-gate: OK` both present as literal strings, with the refusal appearing before the post-revert `OK` in the narrative sequence.
- `docs-linerefs.test.ts` named 13 times; the guard's own failing assertion text quoted verbatim; both legitimate routes stated.
- `.planning/milestones/v0.3.0-MILESTONE-AUDIT.md` named (4 occurrences) alongside `tech_debt` audit files (9 occurrences of `tech_debt`).
- `gaps_found` round files shown present in `auditFiles`, absent from `gatedAudits`.
- Exit code `2` shown from the real-tree `--hook` invocation.
- `grep -c 'pass 3' 12-GATE-PROOF.md` → 2 (≥ 1 required; docs-linerefs's own 3-test green output appears twice — baseline and post-revert).
- Closing section names `scripts/audit-gate.mjs`, `checkAuditGate()`, and line `298`; states the `tech_debt` strictness decision; states the Bash-evasion limitation.
- `git diff --quiet CLAUDE.md` → exit 0 (byte-identical to pre-plant).
- `git status --porcelain` → empty, both immediately after the revert and after the final commit.
- `cd .claude/mcp/vice && npm test` → 2194 pass / 0 fail / 30 skipped / 5 todo, exit 0 (re-run in isolation after the transient-contention note above).
- `cd .claude/mcp/vice && npm run typecheck` → clean, exit 0.
- `node scripts/audit-gate.mjs` → exit 0, `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`.
- `node scripts/check-npm-packages.mjs` → OK, both tarballs unaffected (the new artifact lives under `.planning/`, never shipped in either package).
- `git status --porcelain docs/` → empty (D-12-19: the artifact lives under the phase directory, not `docs/`).
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no accidental deletions in the task commit).
- `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` confirmed still present under `.planning/todos/pending/` and CI's `npm test` command (the full `*.test.*` glob) confirmed unchanged in `.github/workflows/ci.yml`.

## User Setup Required

None — no external service configuration required. The plan's `<verify>` block's `<human-check>` (a live, in-session hook block, requiring a fresh Claude Code session so the now-committed `.claude/settings.json` is loaded) is explicitly deferred, per the plan's own text, to an end-of-phase step outside this plan's task.

## Next Phase Readiness

GATE-01's criteria 1 and 2 now have committed, real-tree evidence; criterion 3's citation is embedded in the transcript's closing section. The only remaining open item for phase close is the plan's own `<human-check>` (live in-session hook block, requiring a session restart or `/hooks` reload) — not part of this plan's task, and explicitly out of scope for an autonomous executor per the hard prohibition on nested/restarted sessions.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*

## Self-Check: PASSED

- `.planning/phases/12-audit-integrity-instrument/12-GATE-PROOF.md` -- FOUND on disk.
- `.planning/phases/12-audit-integrity-instrument/12-04-SUMMARY.md` -- FOUND on disk.
- Commit `16d5ed6` -- FOUND in `git log --oneline --all`.
