---
phase: 12-audit-integrity-instrument
plan: 03
subsystem: ci-gates
tags: [gate-01, audit-integrity, settings, hooks, pretooluse, gitignore]

# Dependency graph
requires: ["12-01", "12-02"]
provides:
  - ".claude/settings.json: committed, hooks-only PreToolUse wiring (Write|Edit|Bash -> node \"${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs\" --hook, timeout 30)"
  - ".claude/settings.local.json: merged machine-specific permissions.allow (39 entries) and permissions.additionalDirectories (3 worktree paths), still ignored"
  - ".gitignore: amended split-rationale block, now ignoring settings.local.json instead of settings.json"
  - ".claude/mcp/vice/audit-integrity.test.ts: a 'settings wiring' describe block (5 tests) guarding the hook block itself"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A machine-specific settings.json split into a committed hooks-only file and an ignored .local.json half, merged (never overwritten) with the local file's pre-existing content -- the same split shape as .gitignore's other machine-specific carve-outs (/.vscode/), but for Claude Code's own config"
    - "Layer 1 (audit-integrity.test.ts) now asserts its own delivery mechanism (the settings.json hook block), not just the script it wires -- closing the last silent-deletion gap named by T-12-09"

key-files:
  created: []
  modified:
    - .claude/settings.json
    - .claude/settings.local.json
    - .gitignore
    - .claude/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "MultiEdit and NotebookEdit deliberately left out of the PreToolUse matcher (Write|Edit|Bash only), even though audit-gate.mjs's --hook mode (plan 12-02) already recognises them via its field-name-agnostic extraction. Adding untested matcher names to the live wiring would be a claim this phase never verified -- no MultiEdit/NotebookEdit call was exercised against the real hook runtime in either 12-02 or 12-03. If a future plan verifies those tool names fire PreToolUse with the expected shape, widening the matcher is a one-line change; narrowing it silently would now be caught by the new wiring test's Write/Edit assertions (Bash has its own dedicated assertion, but Write/Edit are asserted too)."
  - "The settings.local.json merge unions the allow arrays with the local file's four pre-existing entries kept first, then appends settings.json's 35 entries with exact-string deduplication (none were duplicates; merged length is 39, confirming no collision). additionalDirectories carried across verbatim (3 paths). disabledMcpjsonServers left untouched. Order chosen so the file's pre-existing local-only permissions remain visually first, matching the plan's 'preserve the existing four entries' instruction."
  - "The wiring test's non-vacuity probes (settings.json moved aside; matcher narrowed to Write|Edit) were run manually against the real committed file during execution, then reverted, rather than committed as permanent break/restore automation -- matching the plan's own acceptance-criteria phrasing ('record both outputs'), not a request for a self-mutating test."

patterns-established: []

requirements-completed: [GATE-01]

# Metrics
duration: ~40min
completed: 2026-08-21
---

# Phase 12 Plan 03: Wire Layer 2 into the repo -- committed settings.json plus its own guard Summary

**A hooks-only `.claude/settings.json` is now committed, declaring the `Write|Edit|Bash` PreToolUse hook that calls `audit-gate.mjs --hook`; the machine-specific permission allowlist moved intact into `.claude/settings.local.json`; and Layer 1 now asserts the wiring block itself, proven non-vacuous by two live break-and-restore probes against the real committed file.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files modified:** 4 (`.claude/settings.json`, `.claude/settings.local.json`, `.gitignore`, `.claude/mcp/vice/audit-integrity.test.ts`)

## Accomplishments

- **Split `.claude/settings.json` cleanly, losing nothing.** The prior on-disk file held 35 `permissions.allow` entries and 3 `additionalDirectories` worktree paths -- all machine-specific. Merged into `.claude/settings.local.json`'s pre-existing 4-entry `permissions.allow` array (union, exact-string dedup, no collisions found: merged length 39) and its `disabledMcpjsonServers` left untouched. `.claude/settings.json` was then replaced entirely with a single-key `{ "hooks": { "PreToolUse": [...] } }` object: matcher `Write|Edit|Bash`, command `node "${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs" --hook`, timeout 30. Verified byte-for-byte absence of `/home/`, `permissions`, and `additionalDirectories` substrings in the committed text.
- **`.gitignore` now records the split rather than erasing the old rationale.** The prior `/.claude/settings.json` rule (with its four-line "machine-specific, must not be committed" comment) was replaced with `/.claude/settings.local.json`, under a rewritten 10-line comment explaining what moved, why, and that the split is a continuation of the original rule's intent, not a reversal of it.
- **Layer 1 now guards its own delivery mechanism.** Added a `describe("settings wiring: ...")` block of 5 tests to `audit-integrity.test.ts`: hooks-only shape + absolute-path/permissions-key redline, matcher+command+timeout shape (with a dedicated Bash-heredoc-bypass failure message), script-path resolution against the real `scripts/audit-gate.mjs` on disk, `.gitignore` rule-direction check (comment-stripped), and a `scripts/githooks/` absence check citing D-12-06. Full suite: 27/27 pass (12 Layer 1 + 10 hook-mode + 5 new wiring).
- **Both required non-vacuity probes run live against the real committed file, then reverted:**
  - Moved `.claude/settings.json` aside: `node --test audit-integrity.test.ts` exited 1, with 3 subtests failing, the first naming `expected /home/henrik/dev/henrik/git/c64-re-tools/.claude/settings.json to exist -- it must be committed, not just locally present`. Restored: exit 0, 27/27 pass.
  - Narrowed the live matcher to `Write|Edit`: exited 1, 1 subtest failing with `expected the PreToolUse matcher to cover "Bash" -- omitting it would let a heredoc/shell write bypass the audit gate entirely (T-12-02's Bash-write route)...`. Restored via a saved copy: exit 0, 27/27 pass, and `git diff --quiet .claude/settings.json` confirmed byte-identical to the version committed in Task 1.
- **Full verification suite re-run clean after both tasks:** `npm run typecheck` clean; `npm test` → 2229 tests, 2194 pass, 0 fail, 30 skipped, 5 todo (pre-existing, unrelated); `node scripts/audit-gate.mjs` → `OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`, exit 0; `node scripts/check-npm-packages.mjs` → OK, both tarballs unaffected (neither settings file nor the test change ships in either npm package).

## Task Commits

1. **Task 1: Split .claude/settings.json into a committed hooks-only file and an ignored local file** - `d34c52f` (feat)
2. **Task 2: Make Layer 1 guard the hook wiring itself** - `f2d0169` (test)

## Files Created/Modified

- `.claude/settings.json` - Replaced entirely: now a committed, hooks-only file wiring `Write|Edit|Bash` PreToolUse to `audit-gate.mjs --hook`.
- `.claude/settings.local.json` - Merged: gained the prior settings.json's `permissions.allow` (union, deduplicated) and `permissions.additionalDirectories` (verbatim); `disabledMcpjsonServers` untouched. Remains git-ignored.
- `.gitignore` - The `/.claude/settings.json` ignore rule replaced with `/.claude/settings.local.json`, with a rewritten rationale comment recording the split.
- `.claude/mcp/vice/audit-integrity.test.ts` - Added a 5-test "settings wiring" describe block guarding the hook block's existence, shape, script-path resolution, `.gitignore` direction, and the absence of a second enforcement route.

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: `MultiEdit`/`NotebookEdit` deliberately excluded from the matcher despite the script recognising them (no untested claim); the local-settings merge preserves the existing four entries first, then unions in the prior settings.json's 35 (39 total, no dupes), carries `additionalDirectories` verbatim; the two non-vacuity probes were run manually and reverted rather than committed as self-mutating automation, per the plan's own "record both outputs" phrasing.

## Deviations from Plan

None -- both tasks executed exactly as written. All acceptance criteria in `12-03-PLAN.md` were verified directly (see Verification Evidence below), including the two non-vacuity break-and-restore probes.

## Threat Flags

None beyond `12-03-PLAN.md`'s own `<threat_model>` (T-12-09, T-12-10, T-12-11, T-12-12) -- no new network endpoint, auth path, or schema change at a trust boundary was introduced. This plan is entirely local config/test wiring.

## Verification Evidence

**Task 1 acceptance criteria** (all verified):
- `node -e ...` hooks-only check → `hooks-only OK`.
- `grep -c '/home/' .claude/settings.json` → 0; `grep -ci 'permissions\|additionalDirectories'` → 0.
- Matcher+command check → `matcher+command OK`.
- `.claude/settings.local.json` parses; `disabledMcpjsonServers` still contains both `mastra` and `vice`; `permissions.allow` length 39 (4 + 35, no exact duplicates).
- `additionalDirectories` length 3 in the local file → `local merge OK`.
- `git check-ignore -v .claude/settings.local.json` → matches (`.gitignore:61`); `git check-ignore .claude/settings.json` → exit 1 (no match).
- `git status --porcelain .claude/settings.json` → showed `??` (untracked, no longer invisible) before staging, then `A` after `git add`.
- `grep -v '^#' .gitignore | grep -c '/.claude/settings.json'` → 0; same for `/.claude/settings.local.json` → 1.
- Comment block before the `/.claude/settings.local.json` line: 10 consecutive `#`-prefixed lines (lines 50-60), well over the required 4.
- `test ! -d scripts/githooks` → true; `git diff --quiet .github/workflows/ci.yml` → clean (scope fence intact).

**Task 2 acceptance criteria** (all verified):
- `node --test audit-integrity.test.ts` → `# pass 27`, `# fail 0` (exceeds the plan's "25 or more" floor).
- Non-vacuity probe 1 (settings.json moved aside): exit 1, 3 subtests failed, missing-file message confirmed; restored: exit 0, 27/27 pass.
- Non-vacuity probe 2 (matcher narrowed to `Write|Edit`): exit 1, 1 subtest failed, heredoc-bypass message confirmed; restored: exit 0, 27/27 pass.
- `git diff --quiet .claude/settings.json` after both probes → clean (byte-identical to Task 1's committed version).
- `npm run typecheck` → clean, exit 0.
- `npm test` → 2229 tests / 2194 pass / 0 fail / 30 skipped / 5 todo.
- `node scripts/audit-gate.mjs` → exit 0, `OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`.
- `node scripts/check-npm-packages.mjs` → OK, both tarballs unaffected.

**Plan-level `<verification>` block** (all re-run independently after both tasks):
- `npm test`, `npm run typecheck` -- both clean.
- `node scripts/check-npm-packages.mjs` -- OK.
- `git check-ignore .claude/settings.json` -- exit 1; `git check-ignore -v .claude/settings.local.json` -- matches.
- `git diff --quiet .github/workflows/ci.yml` and `test ! -d scripts/githooks` -- scope fences intact.
- `git status --porcelain .claude/settings.local.json` -- empty (the local half never entered either commit).

## User Setup Required

None -- both commits landed on `main` directly (`worktree: false`, sequential execution per this plan's own frontmatter). The hook is live for this checkout the next time Claude Code reads `.claude/settings.json` at session start; no restart was triggered by this plan (the hard prohibition on nested sessions/restarts was honoured throughout).

## Next Phase Readiness

Layer 2 (the PreToolUse hook) is now wired end-to-end: script (12-01) -> hook mode (12-02) -> committed settings wiring + self-guard (12-03). Plan 12-02's one open note -- whether Claude Code actually routes a `PreToolUse` hook to a subagent's tool calls (A2, unconfirmed on this host because no hook existed to observe) -- can now, for the first time, actually be observed empirically on this exact host, since a real hook is live. No blockers identified for phase close.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*

## Self-Check: PASSED

- `.claude/settings.json` confirmed present on disk (FOUND), hooks-only, tracked by git.
- `.claude/settings.local.json` confirmed present on disk (FOUND), still git-ignored.
- `.claude/mcp/vice/audit-integrity.test.ts` confirmed present on disk (FOUND), "settings wiring" describe block present, 27/27 tests passing.
- Both commits (`d34c52f`, `f2d0169`) confirmed present in `git log --oneline --all`.
