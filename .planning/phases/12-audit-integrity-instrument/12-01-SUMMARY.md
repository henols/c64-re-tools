---
phase: 12-audit-integrity-instrument
plan: 01
subsystem: ci-gates
tags: [gate-01, audit-integrity, docs-guards, milestone-audit, node-test]

# Dependency graph
requires: []
provides:
  - "scripts/audit-gate.mjs: the single check point answering both 'is any docs guard red right now?' and 'does this text declare a gated status?' (docsGuardFiles, DOCS_GUARD_FLOOR, EXPECTED_DOCS_GUARD_NAMES, runGuardsLive, frontmatterStatus, isGatedStatus, milestoneAuditFiles, checkAuditGate, plus a --root/--json CLI)"
  - ".claude/mcp/vice/audit-integrity.test.ts: Layer 1 (clean-checkout, zero-setup) plus the committed planted-violation/false-negative pair and the T-12-06 walk-containment test"
affects: [12-02-hook-mode, 12-03-settings-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A gate's guard set is derived from disk via a filtered readdirSync with a non-vacuity floor, never a hand-typed array (D-12-07/D-12-08)"
    - "A subprocess-driving test (never a direct import of an .mjs a strict-allowJs:false tsconfig can't typecheck) exercises the exact CLI contract a human/hook both use"
    - "mkdtempSync-built synthetic trees for planted-violation/false-negative fixtures, instead of a committed always-failing fixture that could join the very glob it exists to test"
    - "Strip NODE_TEST_* from a subprocess's env before spawning a nested `node --test`, so a gate's own test suite doesn't corrupt the gate's own live guard run"

key-files:
  created:
    - scripts/audit-gate.mjs
    - .claude/mcp/vice/audit-integrity.test.ts
  modified: []

key-decisions:
  - "Diverged from 12-PATTERNS.md's committed-fixture recommendation for the planted-violation/false-negative pair in favour of mkdtempSync-built synthetic trees, entirely outside the repo, per D-12-16's own text. A committed file literally named docs-*.test.ts that always fails is exactly the leak this phase must not create -- it would be one recursive-glob change, or one change to .claude/mcp/vice's own *.test.* glob, away from redding CI permanently. mkdtempSync trees are structurally incapable of joining that glob and are this repo's own established synthetic-tree idiom (install-resources.test.ts)."
  - "checkAuditGate() always runs the derived guard set live, unconditionally, rather than only when a gated audit is discovered -- simpler than the plan's conditional phrasing and still satisfies D-12-10 (re-run live on every invocation) plus the --json contract's need to report true guard state even with nothing gated yet."
  - "runGuardsLive() strips every NODE_TEST_* key from the guard subprocess's environment (Rule 1 auto-fix, discovered by the planted-violation test itself, not assumed): when audit-gate.mjs runs from inside a node --test process (exactly what audit-integrity.test.ts does), Node sets NODE_TEST_CONTEXT in the parent's env; inherited unmodified, the nested `node --test` silently switches its reporter to the parent-child IPC/v8-serialization protocol instead of TAP-on-stdout, so a genuinely red guard reported exit 0 with no parseable output -- the exact 'green when it should be red' failure GATE-01 exists to prevent."

patterns-established:
  - "D-12-15 refusal reasons are built from three explicitly labelled parts (offending guard name(s), the guard's own captured assertion text truncated to a bounded length, and the two legitimate routes), never a single opaque failure string."

requirements-completed: [GATE-01]

# Metrics
duration: ~90min
completed: 2026-08-21
---

# Phase 12 Plan 01: The audit-gate check point and Layer 1 Summary

**`scripts/audit-gate.mjs` is now the one place that answers "would a milestone audit's declared status be allowed right now", derived-guard-set and live-rerun both proven non-vacuous, with `audit-integrity.test.ts` exercising it end to end -- including a self-inflicted bug the planted-violation test caught before it ever reached a real milestone close.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 2
- **Files created:** 2 (`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`)

## Accomplishments

- `scripts/audit-gate.mjs` implements exactly the eight-name interface this plan specified: `docsGuardFiles()` (derived, sorted, non-recursive), `DOCS_GUARD_FLOOR` (4), `EXPECTED_DOCS_GUARD_NAMES` (frozen, the four current guards), `runGuardsLive()` (argv-array `spawnSync`, captured stdout/stderr, never inherited stdio), `frontmatterStatus()` (column-zero frontmatter-only scan), `isGatedStatus()` (`passed`/`tech_debt` gated, `gaps_found` never), `milestoneAuditFiles()` (recursive walk skipping dot- and symlinked directories), and `checkAuditGate()` (ties it all together with a three-part D-12-15 refusal reason). CLI supports `--root <dir>` and `--json`.
- **Measured against the real tree, exactly matching the plan's pre-stated ground truth:** `node scripts/audit-gate.mjs --json` reports `guardFiles` of length 4 (`docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`), `auditFiles` of length 6, `statusCounts: {tech_debt: 3, gaps_found: 2, passed: 1}`, and `gatedAudits` of length exactly 4 (the one `passed` plus the three `tech_debt`) -- confirmed by direct inspection of the six committed `*MILESTONE-AUDIT*.md` files under `.planning/milestones/` before writing any code.
- `.claude/mcp/vice/audit-integrity.test.ts` drives the gate as a subprocess (never an `import`, since `tsconfig.json`'s `allowJs: false` fails `npm run typecheck` with TS7016 on a direct import -- measured, not assumed) across 12 tests: file/shebang existence, the anti-recursion check (D-12-09), the derived-floor/exact-membership check (D-12-07/08), the real-tree allowed/frontmatter-only checks (D-12-02/T-12-04), the planted violation and false-negative pair (D-12-16), `gaps_found`-never-gated (D-12-13), `tech_debt`-gated (D-12-12), the prose-false-positive trap (T-12-04), the below-floor structural failure (D-12-08), and the symlink/dot-directory walk-containment test (T-12-06).
- **Found and fixed a real bug via the planted-violation test itself, before it ever reached a real milestone close:** `runGuardsLive()`'s nested `node --test` inherited `NODE_TEST_CONTEXT` from the outer test-runner process whenever the gate ran from inside `audit-integrity.test.ts` (or any future CI step running the whole suite under `--test`). That env var makes Node's test runner switch its child's reporter to an IPC/v8-serialization protocol instead of TAP-on-stdout, so a guard that was actually failing reported exit 0 with empty parsed output to the gate -- silently allowing exactly the audit-status-over-a-red-guard scenario GATE-01 exists to prevent. Fixed by stripping every `NODE_TEST_*` key from the subprocess's environment before spawning.

## Task Commits

1. **Task 1: Build scripts/audit-gate.mjs — the single check point** - `ad0bb8b` (feat)
2. **Task 2: Build .claude/mcp/vice/audit-integrity.test.ts — Layer 1 plus the planted pair** (includes the `NODE_TEST_*` env-strip fix to Task 1's file) - `eb56dd8` (test)

## Files Created/Modified

- `scripts/audit-gate.mjs` - The single check point: guard-set derivation, live guard run (env-sanitized), milestone-audit discovery, frontmatter-only status parse, D-12-15 refusal message, CLI contract.
- `.claude/mcp/vice/audit-integrity.test.ts` - Layer 1: 12 tests over the real tree plus mkdtempSync-built synthetic trees for the planted pair and the walk-containment test.

## Decisions Made

- Diverged from `12-PATTERNS.md`'s committed-fixture recommendation for the planted-violation/false-negative pair, per D-12-16's own reasoning explained above (mkdtempSync, never a committed always-failing fixture).
- `checkAuditGate()` always runs the live guard set unconditionally rather than conditioning it on "at least one gated audit"; simpler, and still satisfies D-12-10 plus `--json`'s need for true guard state on every call.
- `runGuardsLive()` now strips `NODE_TEST_*` from the child environment (Rule 1 auto-fix; see Accomplishments and Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `runGuardsLive()`'s nested `node --test` silently reported green under a red guard when invoked from inside another `node --test` process**
- **Found during:** Task 2, while writing and running the planted-violation test (`audit-integrity.test.ts`) — the test initially failed because the gate reported `allowed: true` against a synthetic tree with a deliberately-failing planted guard.
- **Issue:** Node's test runner sets `NODE_TEST_CONTEXT=child-v8` in its own process's `process.env`. `runGuardsLive()`'s `spawnSync` inherited that unmodified, so the nested `node --test docs-*.test.ts` invocation switched its reporter to the parent-child IPC/v8-serialization protocol instead of TAP on stdout. The gate's TAP-based failure parsing then saw no output and the guard subprocess's own exit code was masked to 0.
- **Fix:** `runGuardsLive()` now builds a copy of `process.env` with every `NODE_TEST_*`-prefixed key deleted before calling `spawnSync`, restoring normal TAP-on-stdout behaviour and an accurate exit code regardless of the calling process's own test-runner context.
- **Files modified:** `scripts/audit-gate.mjs`
- **Commit:** `eb56dd8` (folded into Task 2's commit, since it was discovered by and is proven by Task 2's own test)

No other deviations — Task 1 otherwise executed exactly as written; verified directly against the acceptance criteria below both before and after the fix.

## Issues Encountered

The plan's acceptance criterion `node --test audit-integrity.test.ts -t "planted violation"` does not filter on this environment's Node (v22.22.0): `-t` is not a recognized shorthand for `--test-name-pattern` in this version (confirmed via `node --test --help`, and via a bogus pattern that still ran all 12 tests). This does not affect correctness — the full-suite run already proves the named tests pass (12/12), and the `--test-name-pattern=` long form was not substituted since the acceptance text specifies `-t` verbatim. Documented here rather than silently worked around.

## Verification Evidence

**Task 1 acceptance criteria** (all verified, post-fix):
- `head -1 scripts/audit-gate.mjs` → `#!/usr/bin/env node`.
- `git ls-files -s scripts/audit-gate.mjs` → mode `100644`.
- `grep -c '4f048bb' scripts/audit-gate.mjs` → 2 (≥ 1).
- `node scripts/audit-gate.mjs --json` → exit 0; JSON parses; `guardFiles` length 4 with all four expected names; `auditFiles` length 6; `statusCounts: {tech_debt: 3, gaps_found: 2, passed: 1}`; `gatedAudits` length 4, no `gaps_found` file present.
- `node -e` importing the module: `frontmatterStatus()` on `v0.2.0-MILESTONE-AUDIT.md`'s full text returns exactly `tech_debt`.
- `grep -nE 'npm (run )?test' scripts/audit-gate.mjs` → no match (the literal strings are described only via generic paraphrase in the header, deliberately never spelled out).
- `grep -niE 'waiver|AUDIT_GATE_SKIP|process\.env\.[A-Z_]*(SKIP|OVERRIDE|BYPASS|FORCE)'` → 2 matches, both prose stating no such hatch exists (the header's WHAT NOT TO DO paragraph, and the runtime refusal reason's own D-12-14 statement) — no actual hatch anywhere in code.
- `grep -nE '\beval\(|\brequire\(|\bimport\('` → no match.
- `grep -n 'shell: *true'` → no match.
- `node --test .claude/mcp/vice/docs-linerefs.test.ts` still passes (3/3) — the four real guards are untouched (`git diff --quiet` on all four confirmed clean).

**Task 2 acceptance criteria** (all verified):
- `node --test audit-integrity.test.ts` → exit 0, `# pass 12`, `# fail 0`.
- `-t "planted violation"` / `-t "planted false-negative"` / `-t "descends neither a symlinked directory nor a dot-directory"` → all exit 0 (see Issues Encountered re: `-t` not filtering on this Node version; full-suite pass count confirms each named test passes).
- `npm run typecheck` → clean, exit 0 (confirms no `import` of the `.mjs` script).
- `grep -c 'import.*scripts/audit-gate.mjs' audit-integrity.test.ts` → 0.
- `ls .claude/mcp/vice/ | grep -c '^docs-audit-integrity'` → 0.
- The recursion `node -e` check → `no recursion, 4 guards`.
- No leaked `/tmp/audit-gate-planted-*` directories after the real test suite run (confirmed 0 both before and after; four leftovers from ad-hoc manual debugging scripts during bug investigation were cleaned up separately and are not test artifacts).
- `cd .claude/mcp/vice && npm test` → full suite: 2179 pass / 0 fail / 30 skipped / 5 todo (pre-existing, unrelated to this plan).
- `node scripts/check-npm-packages.mjs` → OK, both tarballs unaffected (neither new file ships in either npm package, by design — both are dev/CI-only).

**Plan-level `<verification>` block** (all re-run independently after both tasks):
- `npm test`, `npm run typecheck` — both clean.
- `node scripts/audit-gate.mjs` (human mode) → `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`, exit 0.
- `node scripts/check-npm-packages.mjs` — OK.
- All four existing guard files confirmed byte-unmodified via `git diff --quiet`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This plan delivers the shared contract (`scripts/audit-gate.mjs`'s exported names and CLI shape) that plan 12-02 (`--hook` mode) and plan 12-03 (settings wiring) both attach to without renaming or re-deriving anything. No blockers identified.

## Self-Check: PASSED

- `scripts/audit-gate.mjs` confirmed present on disk (FOUND), mode `100644`.
- `.claude/mcp/vice/audit-integrity.test.ts` confirmed present on disk (FOUND).
- Both commits (`ad0bb8b`, `eb56dd8`) confirmed present in `git log --oneline -5`.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*
