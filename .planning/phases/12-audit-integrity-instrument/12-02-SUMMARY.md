---
phase: 12-audit-integrity-instrument
plan: 02
subsystem: ci-gates
tags: [gate-01, audit-integrity, hooks, pretooluse, milestone-audit, node-test]

# Dependency graph
requires: ["12-01"]
provides:
  - "scripts/audit-gate.mjs --hook: a PreToolUse-shaped hook mode on the same single check point, exporting extractHookTarget/isHookInScope/writtenDeclaresGatedStatus alongside plan 12-01's existing surface"
  - ".planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md: the empirical resolution of RESEARCH assumption A1, plus an honest record that Route A's assumed live hooks do not exist on this host"
  - ".claude/mcp/vice/audit-integrity.test.ts: a hook-mode describe block (10 tests) pinning the full --hook contract"
affects: ["12-03-settings-wiring"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Field-name-agnostic payload extraction with a shapeKnown:false fallback that still evaluates and, when in scope, still refuses by name -- a future tool_input rename surfaces as a loud refusal, never a silent no-op (T-12-08)"
    - "Fail-open outside a narrow matcher/token scope, fail-closed on every error once inside it -- a bug in the gate cannot brick unrelated Write/Edit/Bash calls, but cannot silently permit the one write class GATE-01 cares about either"
    - "Content-adjacency regex scanning for Bash write-target detection (never a shell-syntax parser), with the accepted evasion limitation (T-12-02) named in both code and this SUMMARY rather than implied away"
    - "Session-transcript inspection as a restart-free, hook-free empirical evidence source when the environment does not match a research document's assumptions"

key-files:
  created:
    - .planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md
  modified:
    - scripts/audit-gate.mjs
    - .claude/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "RESEARCH.md's Route A (piggyback on live-registered ~/.claude/hooks/gsd-*.js PreToolUse hooks) does not hold at execution time: this host's ~/.claude/hooks/ and ~/.claude/settings.json carry no PreToolUse hooks at all, and this repo has no .claude/hooks/ directory. The four named scripts exist only as PROJECT-scoped hooks in other repos on this machine (a different, npm-gsd-core-installed GSD variant), not as this host's global hooks. Resolved RESEARCH assumption A1 anyway, without registering a new hook or restarting the session, by reading this project's own Claude Code session transcripts (~/.claude/projects/.../*.jsonl) -- each tool_use.input block is definitionally the same object a PreToolUse hook receives as tool_input. Confirmed Write's {file_path, content}, Edit's {file_path, old_string, new_string, replace_all}, and Bash's {command, description} directly from verbatim transcript excerpts. A3 (heredoc full-body capture) and A2 (subagent hook routing) remain explicitly UNCONFIRMED -- backstopped by Task 2's field-agnostic extraction and by Layer 1 respectively."
  - "Fail-closed, narrowly scoped (Q1 from RESEARCH.md's Open Questions): out-of-scope calls (wrong tool_name, or no *MILESTONE-AUDIT*.md token anywhere in the relevant target) exit 0 before any spawnSync, unconditionally. Once a call is in scope, every subsequent internal failure -- malformed JSON, an unrecognised tool_input shape, a truncated stdin read, a guard-spawn failure -- exits 2 rather than 0. This is the scoping choice CONTEXT.md's Pitfall 5 left open: absolute fail-closed only within the narrow write class GATE-01 cares about, so a bug in this file cannot brick unrelated Write/Edit/Bash calls repo-wide."
  - "T-12-02 accepted limitation, stated plainly rather than implied away: the Bash-mode regex scan matches literal command TEXT adjacency (writer token immediately or eventually preceding a MILESTONE-AUDIT...md token), never shell syntax. A base64-encoded payload or a python -c one-liner that assembles the write target or the gated text at runtime evades this scan by design. Layer 1 (audit-integrity.test.ts / checkAuditGate(), from plan 12-01) re-reads the actual committed file content regardless of how the shell wrote it, and is the unevadable enforcement point this hook is only a partial backstop for."
  - "writtenDeclaresGatedStatus() reuses isGatedStatus() (plan 12-01) for the passed/tech_debt check rather than hardcoding the status set a second time -- D-12-12/D-12-13's gated-status definition stays in exactly one place, even though hook mode's line-scan tolerates leading whitespace where frontmatterStatus()'s column-zero scan does not."
  - "hookGuardVerdict() deliberately does NOT scan planningDir for already-gated audits the way checkAuditGate() does -- hook mode's question is narrower ('if this in-scope write lands, is any guard red right now?'), not 'what does the whole tree currently declare?'. Reuses docsGuardFiles()/runGuardsLive()/DOCS_GUARD_FLOOR/EXPECTED_DOCS_GUARD_NAMES exactly as check mode does (D-12-01: one seam, no duplicate logic)."

patterns-established:
  - "A malformed-JSON stdin payload is evaluated for scope against its RAW text with \\n/\\r escape sequences decoded back to real line breaks before the line-anchored status scan runs -- JSON-source text stores an embedded newline as the two-character escape \\n, never an actual line-break byte, so the undecoded scan would never find a status: line inside a broken content value."

requirements-completed: [GATE-01]

# Metrics
duration: ~150min
completed: 2026-08-21
---

# Phase 12 Plan 02: PreToolUse hook mode and the empirical stdin resolution Summary

**`scripts/audit-gate.mjs --hook` now refuses, at the moment of writing, any in-scope tool call that would record a gated milestone-audit status while a docs guard is red -- built field-name-agnostic after discovering this host's assumed live PreToolUse hooks do not actually exist, resolved instead from this project's own session transcripts.**

## Performance

- **Duration:** ~150 min
- **Tasks:** 3
- **Files created:** 1 (`12-HOOK-STDIN-EVIDENCE.md`)
- **Files modified:** 2 (`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`)

## Accomplishments

- **Task 1 found the plan's own environmental assumption was wrong, and recovered without breaking the hard prohibition on restarts/nested sessions.** `12-RESEARCH.md` claimed `$HOME/.claude/hooks/gsd-prompt-guard.js` and three siblings are live, global `PreToolUse` hooks on this host. They are not: `~/.claude/hooks/` holds two unrelated scripts, `~/.claude/settings.json`'s `hooks` key holds exactly one `PostToolUse` entry, and this repo has no `.claude/hooks/` directory at all. The four named scripts exist only as **project-scoped** hooks belonging to a different, npm-`gsd-core`-installed GSD variant used in other repos on this machine (confirmed via a `gsd-cleanup-backup-20260525-*` snapshot showing them present globally as of 2026-05-25, and absent now). Resolved RESEARCH assumption A1 anyway by reading this exact project's own `~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/*.jsonl` session transcripts -- each recorded `tool_use.input` block is definitionally the same object a `PreToolUse` hook receives as `tool_input`. Confirmed, with verbatim quotes: `Write` → `{file_path, content}`; `Edit` → `{file_path, old_string, new_string, replace_all}`; `Bash` → `{command, description}`, the last one pulled from this exact orchestrating session's own pre-wave dependency check. A3 (heredoc full-body capture) and A2 (subagent hook routing) recorded as explicitly `UNCONFIRMED`.
- **Task 2 extended `scripts/audit-gate.mjs` with `--hook` mode -- no wrapper file, per D-12-01.** Bounded stdin read (5000ms timeout, 10 MiB cap, T-12-01); defensive `JSON.parse` with a raw-text fail-closed fallback for malformed payloads (decoding `\n`/`\r` escapes back to real line breaks first, since JSON-source text never contains a literal newline byte inside a string value); field-name-agnostic `extractHookTarget()`/`isHookInScope()` with a `shapeKnown: false` fallback that recursively joins every string leaf of `tool_input` (minus `old_*` keys) and still refuses loudly, naming the unrecognised keys, when in scope (T-12-08); Bash-specific content-adjacency scanning covering `>`, `>>`, `tee [-a]`, `dd of=` (target immediately after the writer) plus `sed -i`/`perl -i` (target anywhere later in the same command, since the edit script comes between the flag and the filename in real usage) (D-12-04); and a D-12-15 three-part stderr refusal (red guard name(s), truncated assertion text, both legitimate routes) with `exit 2` as the sole blocking mechanism -- never the `exit 2` + JSON `permissionDecision` combination, which is unreliable per `anthropics/claude-code#43407` (named in an inline comment so a future maintainer does not "improve" this by adding it back).
- **Task 3 pinned the full contract with 10 committed tests**, reusing plan 12-01's `buildSyntheticTree()` builders and adding a `runHook()` `spawnSync`-over-stdin helper. Every payload is constructed as a JS string/object and piped via `spawnSync`'s `input` option, never assembled as an inline Bash command line -- documented as a hazard comment, since a live-wired hook (plan 12-03) could otherwise block the very Bash call constructing the test payload.
- **Measured, not assumed, before shipping:** manually ran all nine of Task 2's synthetic-tree scenarios against hand-built green/red trees before writing the committed tests, and found one real bug during that manual pass (see Deviations) before it ever reached the test file.

## Task Commits

1. **Task 1: Resolve the PreToolUse payload shape empirically and record it** - `5d61c14` (docs)
2. **Task 2: Add --hook mode to scripts/audit-gate.mjs** - `d5836aa` (feat)
3. **Task 3: Pin the hook contract with committed tests in audit-integrity.test.ts** - `cb3f7da` (test)

## Files Created/Modified

- `.planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md` - Empirical resolution of RESEARCH assumption A1 via session-transcript inspection, with an explicit record of why Route A/B as literally scripted did not apply on this host.
- `scripts/audit-gate.mjs` - Adds `--hook` mode (bounded stdin read, field-name-agnostic extraction, Bash content-adjacency scan, D-12-15 refusal, exit-2-only output contract) to the same single check point plan 12-01 built.
- `.claude/mcp/vice/audit-integrity.test.ts` - Adds a `describe("hook mode: ...")` group of 10 tests.

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: Route A/B adapted to transcript inspection (A1); fail-closed narrowly scoped to the matcher/token set (Q1); T-12-02's Bash-regex evasion limitation stated plainly, backstopped by Layer 1; `isGatedStatus()` reused rather than re-defining the gated-status set; `hookGuardVerdict()` deliberately narrower in scope than `checkAuditGate()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `rawTextIndicatesScope()`'s line-anchored scan never matched a `status:` line inside malformed JSON text**
- **Found during:** Task 2's manual verification pass (before Task 3's committed tests were written), while proving the "malformed JSON stdin payload... exits 2" acceptance criterion.
- **Issue:** `rawText` in the malformed-JSON fallback path is still JSON SOURCE text -- exactly why it failed to parse. A real line break inside a JSON string value is written as the two-character escape sequence `\n` (backslash, then `n`), never an actual newline byte. `writtenDeclaresGatedStatus()`'s line-anchored regex splits on real `\n` bytes, so a `status: passed` line embedded inside an otherwise-broken `content` value was never found -- the test returned exit 0 (fail-open) when D-12-14/the acceptance criteria required exit 2 (fail-closed in scope).
- **Fix:** `rawTextIndicatesScope()` now decodes `\\n`/`\\r` (the two-character escape sequences) back into real `\n`/`\r` bytes before handing the text to `writtenDeclaresGatedStatus()`.
- **Files modified:** `scripts/audit-gate.mjs`
- **Commit:** `d5836aa` (Task 2's own commit; found and fixed before that commit, not as a follow-up)

**2. [Rule 3 - Blocking issue] Task 1's Route A prerequisite (live-registered global `PreToolUse` hooks) does not exist on this host**
- **Found during:** Task 1, immediately, while attempting to read `$HOME/.claude/hooks/gsd-prompt-guard.js` per the plan's `read_first` instruction.
- **Issue:** The file (and its three named siblings) does not exist at `$HOME/.claude/hooks/`; `$HOME/.claude/settings.json` has no `PreToolUse` key; this repo has no `.claude/hooks/` directory. `12-RESEARCH.md`'s claim that these are global, live-firing hooks "already us[ing]" this host's settings does not hold at execution time (they exist only as project-scoped hooks in other repos on this machine, via a different GSD installation path).
- **Fix:** Rather than register a new hook (which would require an operator-initiated session restart to take effect -- an action this autonomous task cannot itself trigger, and the hard prohibition forbids working around via a nested headless session) or guess at the field shape, resolved A1 by reading this exact project's own Claude Code session transcript files, which record the literal `tool_input`-equivalent JSON for every historical `Write`/`Edit`/`Bash` call. This is a restart-free, hook-free, nested-session-free empirical source that the plan itself did not anticipate but that satisfies the same "resolved by observation, not guessing" requirement.
- **Files modified:** none (this produced `12-HOOK-STDIN-EVIDENCE.md`'s content, not a code change)
- **Commit:** `5d61c14`

No other deviations -- Tasks 2 and 3 otherwise executed exactly as written, verified against every acceptance criterion listed in `12-02-PLAN.md` both manually (Task 2, against hand-built synthetic trees) and via the committed test suite (Task 3).

## Threat Flags

None beyond what `12-02-PLAN.md`'s own `<threat_model>` already names (T-12-01, T-12-02, T-12-03, T-12-05, T-12-08) -- no new network endpoint, auth path, or schema change at a trust boundary was introduced. T-12-02's accepted limitation is restated above rather than omitted.

## Verification Evidence

- `cd .claude/mcp/vice && node --test audit-integrity.test.ts` → `# pass 22`, `# fail 0` (12 from plan 12-01 + 10 new hook-mode tests).
- `cd .claude/mcp/vice && npm run typecheck` → clean, exit 0.
- `cd .claude/mcp/vice && npm test` → `# tests 2224`, `# pass 2189`, `# fail 0`, `# skipped 30`, `# todo 5` (skipped/todo counts pre-existing, unrelated to this plan).
- `node scripts/check-npm-packages.mjs` → OK, both tarballs unaffected.
- `node scripts/audit-gate.mjs` (human/check mode, unaffected by this plan) → `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`, exit 0.
- `git diff --quiet .claude/settings.json .gitignore` → clean; this plan does not touch the settings split, which plan 12-03 owns.
- `grep -nE 'old_string|old_str|old_text' scripts/audit-gate.mjs` → all three occurrences are in the exclusion helper (`isOldKey`) and its doc comments, never in the written-collection key list.
- `grep -n '43407' scripts/audit-gate.mjs` → 2 lines (header HOOK MODE paragraph, inline output-contract comment); `permissionDecision` appears only inside those same two comments, never in emitted output.
- Manually verified every one of Task 2's nine acceptance-criteria scenarios against hand-built `mkdtempSync` green/red trees before Task 3 committed the equivalent automated tests.

## User Setup Required

None -- no external service configuration required. Plan 12-03 still owns wiring `--hook` live into `.claude/settings.json`; this plan builds and proves the script side only, exactly as scoped.

## Next Phase Readiness

Delivers the `--hook` CLI contract (`node scripts/audit-gate.mjs --hook [--root <dir>]`, stdin JSON in, `exit 0`/`exit 2` + stderr out) that plan 12-03 wires into `.claude/settings.json`'s `PreToolUse` array. No blockers identified. One open note for plan 12-03 to read: `12-HOOK-STDIN-EVIDENCE.md`'s A2 finding (subagent hook routing) remains genuinely unconfirmed on this host, since no `PreToolUse` hook exists here to observe either way -- plan 12-03's live wiring, once committed, will be the first opportunity to actually observe it.

## Self-Check: PASSED

- `.planning/phases/12-audit-integrity-instrument/12-HOOK-STDIN-EVIDENCE.md` confirmed present on disk (FOUND).
- `scripts/audit-gate.mjs` confirmed modified and present on disk (FOUND), `--hook` flag present.
- `.claude/mcp/vice/audit-integrity.test.ts` confirmed modified and present on disk (FOUND), hook-mode describe block present.
- All three commits (`5d61c14`, `d5836aa`, `cb3f7da`) confirmed present in `git log --oneline -6`.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*
