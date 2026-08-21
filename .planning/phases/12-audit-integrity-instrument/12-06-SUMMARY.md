---
phase: 12-audit-integrity-instrument
plan: 06
subsystem: infra
tags: [audit-gate, hook, denial-of-service, error-handling, gsd-security]

requires:
  - phase: 12-audit-integrity-instrument (plan 12-05)
    provides: "The bounded, non-backtracking milestone-audit token locator and unanchored Bash gated-status scan that closed CR-01/CR-03/WR-04, leaving CR-02/WR-01/WR-02/WR-03 as the remaining gaps this plan closes."
provides:
  - "An iterative, depth-capped leaf walk (collectStringLeaves, MAX_LEAF_DEPTH=200, MAX_LEAF_NODES=50000) that returns a truncation signal instead of throwing"
  - "Matcher-first dispatch in hookMain: exit 0 before any payload extraction for every tool_name outside the five write-capable ones"
  - "Symmetric try/catch around scope determination (hook mode) and around checkAuditGate()'s check-mode calls (main()), both emitting a diagnosable non-zero exit with no raw stack trace"
  - "A GUARD_RUN_TIMEOUT_MS=15000 bound plus killSignal: SIGKILL on the guard subprocess"
  - "A structural-failure short circuit in checkAuditGate() that skips the guard spawn entirely when the derived guard set is invalid"
  - "Five committed reproductions in audit-integrity.test.ts covering CR-02, the matcher-first short circuit, WR-03 (both output modes) and WR-02"
affects: [12-07]

actuals:
  tokens: 6311
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Explicit-stack iterative tree walk with a depth cap AND a node-count cap, returning a truncation signal rather than throwing or mutating module state -- applied to collectStringLeaves(), generalizable to any other recursive walk over untrusted, arbitrarily-shaped JSON in this codebase."
    - "Matcher-first / extract-second ordering for a payload-shape-agnostic security control: narrow the input set (tool_name) BEFORE running any extraction logic on the payload body, so a bug in extraction can only ever affect the narrowed set."

key-files:
  created: []
  modified:
    - scripts/audit-gate.mjs
    - .claude/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "WR-01 (the guard-subprocess timeout) is gated at SOURCE level only -- no committed runtime test exercises the timeout firing. The only faithful test plants a guard file that never returns and waits out the full 15-second timeout, in a suite that currently runs in ~6.5 seconds; for a WARNING-severity finding that trade was rejected. The fix is pinned by this plan's own region-scoped grep assertions (timeout/killSignal present inside runGuardsLive(), GUARD_RUN_TIMEOUT_MS declared and used, and its value verified less than .claude/settings.json's 30-second PreToolUse budget) instead of a behavioral test."
  - "The depth-truncation signal is threaded as an additive field (extraction.depthTruncated) rather than a module-level mutable variable, preserving the file's zero-mutable-module-state invariant (stated in its own header's exported-surface comment)."
  - "A depth-truncated unrecognised-shape payload is treated as IN SCOPE unconditionally, not refused unconditionally -- hookGuardVerdict() still decides the exit code, so a green tree still exits 0 for the same payload that crashes were once emitted from. This preserves T-12-08's stance (refuse loudly, never pass silently) without turning truncation itself into a second, competing refusal mechanism."
  - "isHookInScope()'s own HOOK_MATCHER_TOOLS check is kept as defence in depth even after hoisting an identical check to the top of hookMain() -- not deleted, per the plan's explicit instruction, so the two checks stay redundant rather than the second becoming dead code with a stale comment."

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "CR-02 closed: the 10,056-byte depth-5000 payload that crashed the live hook with a RangeError and exit 1 now resolves to exit 2 (red tree) or exit 0 (green tree), never a third outcome"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: a deeply-nested unrecognised payload refuses cleanly instead of crashing (CR-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Matcher-first dispatch: a non-write-capable tool_name exits 0 before any payload extraction is attempted, narrowing the blast radius of any extraction bug to Write/Edit/MultiEdit/NotebookEdit/Bash"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#hook mode: an out-of-matcher tool name given the CR-02 crash payload exits 0 before extraction runs"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-03 closed: both check-mode output formats fail cleanly and diagnosably on a bad --root, and --json still emits a single parseable JSON object with a populated structuralErrors array"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#check mode: a bad --root fails cleanly under --json, with structuralErrors and no stack frames (WR-03)"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts#check mode: a bad --root fails cleanly under text mode, with an `audit-gate: FAIL` prefix and no stack frames (WR-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-02 closed: a structurally-invalid guard set (guardCount: 0) fails fast instead of triggering a zero-positional `node --test` full-suite auto-discovery"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "audit-integrity.test.ts#a synthetic tree with zero guard files fails fast instead of auto-discovering the whole suite (WR-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-01 closed: the guard subprocess is bounded to 15 seconds and a timeout reads as red -- gated at source level only, no behavioral test"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "sed -n '/^export function runGuardsLive/,/^}/p' scripts/audit-gate.mjs | grep -c 'timeout' (>=1) and grep -c 'killSignal' (>=1); grep -c 'GUARD_RUN_TIMEOUT_MS' scripts/audit-gate.mjs (>=2)"
        status: pass
    human_judgment: true
    rationale: "No committed runtime test exercises the 15-second timeout actually firing -- doing so faithfully requires planting a guard file that hangs and waiting out the full timeout in a suite that otherwise runs in ~6.5 seconds, which was rejected as the wrong trade for a WARNING-severity finding (a decision this plan's own frontmatter states explicitly). The fix is proven by source-level grep assertions and by direct measurement (a real zero-argument `node --test` in the real .claude/mcp/vice directory does not finish within 20 seconds, confirming the underlying risk this timeout bounds), not by a green/red test transition."
  - id: D6
    description: "D-12-10, D-12-11, D-12-13, D-12-14 all still hold after this plan's rewrites"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "node scripts/audit-gate.mjs --json reports 4 guard files on the real tree (D-12-10 live re-run intact); the pre-existing D-12-13 downgrade test and all four D-12-13 gaps_found negative-control tests pass unmodified; grep -v '^\\s*//' scripts/audit-gate.mjs | grep -c 'process.env' == 1 (D-12-14, no new hatch)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-21
status: complete
---

# Phase 12 Plan 06: Iterative depth-capped leaf walk, matcher-first dispatch, bounded guard subprocess Summary

**Converted `scripts/audit-gate.mjs`'s unrecognised-shape leaf walk from unbounded recursion to an iterative, depth-and-count-capped walk, hoisted the hook's tool-name matcher check above payload extraction, made both `--hook` and check-mode error handling symmetric, and bounded the guard subprocess with a 15-second timeout plus a structural-failure short circuit -- closing CR-02, WR-01, WR-02, and WR-03 from `12-REVIEW.md`.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-21T18:20:00Z (base commit 8f8dfc2)
- **Completed:** 2026-08-21T19:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **CR-02 closed.** `collectStringLeaves()` converted from recursion to an explicit-stack iterative walk. `MAX_LEAF_DEPTH = 200` and `MAX_LEAF_NODES = 50000` bound the walk; exceeding either sets a `truncated` flag instead of throwing. The flag threads through `extractHookTarget()` as an additive `depthTruncated` field, and `isHookInScope()`'s unrecognised-shape branch treats a depth-truncated payload as in scope unconditionally -- `hookGuardVerdict()` still decides the exit code, so the fix does not turn truncation into a second refusal mechanism. `buildHookRefusal()`'s `shapeNote` now names the depth cap explicitly on a truncated refusal (D-12-15). The committed 10,056-byte depth-5000 payload from `12-VERIFICATION.md` now exits 2 against a red tree and 0 against a green one, with no `RangeError` in stderr either way -- proven live via a direct CLI reproduction (scratch file, real synthetic green tree) in addition to the committed test.
- **Matcher-first dispatch added.** `hookMain()` hoists the `HOOK_MATCHER_TOOLS` check above `extractHookTarget()`: a `tool_name` outside `Write`/`Edit`/`MultiEdit`/`NotebookEdit`/`Bash` now exits 0 before any extraction runs at all, rather than only being caught by `isHookInScope()`'s own matcher check after extraction has already executed. `isHookInScope()`'s matcher check is kept as defence in depth, not deleted. Extraction and scope determination are now wrapped in a try/catch mirroring `hookGuardVerdict()`'s existing catch verbatim in shape -- an internal error here exits 2 with the same diagnosable text (`REFUSED (internal error during scope determination)`), never a silent fail-open.
- **WR-03 closed.** `main()`'s check-mode block (`checkAuditGate()` plus its own second calls to `docsGuardFiles()`/`milestoneAuditFiles()`/the `statusCounts` `readFileSync` loop) is wrapped in one try/catch. A bad `--root` now prints `audit-gate: FAIL` plus the error message with zero stack frames under text mode, and still emits a single parseable JSON object with `allowed: false` and a populated `structuralErrors` array under `--json` -- closing the asymmetry where a `--json` consumer previously got nothing on stdout and could not distinguish a typo from a refusal.
- **WR-01 closed (source-level gate).** `runGuardsLive()`'s `spawnSync` call gained `timeout: GUARD_RUN_TIMEOUT_MS` (15000) and `killSignal: "SIGKILL"`. `spawnSync`'s existing `result.error` branch already mapped a timeout to `status: 1` (red), so fail-closed behaviour came for free; the branch now names the timeout explicitly in the returned stderr. As stated in this plan's own frontmatter, no committed runtime test exercises the timeout firing -- the only faithful test plants a hanging guard and waits out the full 15 seconds in a suite that runs in ~6.5 seconds, rejected as the wrong trade for a WARNING-severity finding. The fix is pinned by region-scoped source assertions instead (see Coverage D5).
- **WR-02 closed.** `checkAuditGate()` now short-circuits before its `runGuardsLive()` call when `structuralErrors.length > 0`, mirroring `hookGuardVerdict()`'s existing early return. Pre-fix, an empty derived guard set (`guardCount: 0`) flowed unconditionally into `runGuardsLive(viceDir, [])` -- a zero-positional `node --test`, which Node reads as "auto-discover every test file in the tree." D-12-10's live re-run is unchanged for every non-degenerate guard set; the only skipped case is one where there is nothing valid to run and the verdict is already `false`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Iterative, depth-capped leaf walk (CR-02)** - `484f05b` (fix)
2. **Task 2: Matcher-first dispatch plus symmetric error handling in both modes (WR-03, exit-code contract)** - `055c1ef` (fix)
3. **Task 3: Bound the guard subprocess and stop the structural-failure path from auto-discovering the whole suite (WR-01, WR-02)** - `3776810` (fix)

_TDD note: Tasks 1/2 carried `tdd="true"` at the task level, but this plan's `type: execute` frontmatter (not `type: tdd`) does not invoke the plan-level RED-commit/GREEN-commit gate, matching plan 12-05's precedent. Each task's own `<acceptance_criteria>` prescribed a revert-and-rerun fail-first proof instead, followed exactly as written for Tasks 1 and 2 (new test added, run against the pre-fix committed source to observe red, then the fix applied and the test re-run green) -- one commit per task, no separate RED/GREEN commits. Task 3's fail-first proof for WR-02 is a direct CLI reproduction against the real repo directory rather than the committed synthetic-tree test itself (see Red-Then-Green Reproductions below for why)._

## Files Created/Modified

- `scripts/audit-gate.mjs` - Iterative `collectStringLeaves()` with `MAX_LEAF_DEPTH`/`MAX_LEAF_NODES`; `extractHookTarget()`'s `depthTruncated` field; `isHookInScope()`'s truncation-aware unrecognised-shape branch; `buildHookRefusal()`'s truncation note; `hookMain()`'s hoisted matcher check plus a new try/catch around scope determination; `main()`'s try/catch around the check-mode block; `runGuardsLive()`'s `GUARD_RUN_TIMEOUT_MS` bound; `checkAuditGate()`'s structural-failure short circuit.
- `.claude/mcp/vice/audit-integrity.test.ts` - 5 new tests: 1 CR-02 reproduction (red tree exit 2 / green tree exit 0, both asserting no `RangeError`), 1 matcher-first short-circuit proof (reusing the CR-02 payload with `tool_name: "Read"`), 2 WR-03 tests (`--json` and text mode against a bad `--root`), 1 WR-02 fast-failure proof (`guardCount: 0` under a 5000ms wall-clock bound). Test count: 38 (post-plan-12-05) + 5 = 43, 0 fail.

## Red-Then-Green Reproductions (fail-first proof)

Each defect was seen red against the pre-fix source (the last-committed state before that task's own fix, using `node --test` directly against the working tree at each intermediate commit boundary -- no `git stash`, `git checkout --`, or other working-tree-wide reset was used) and green after:

| Defect | Pre-fix (red) | Post-fix (green) |
|---|---|---|
| CR-02 | `RangeError: Maximum call stack size exceeded`, exit 1 (measured against the real `collectStringLeaves` recursion) | exit 2 (red tree) / exit 0 (green tree), no `RangeError` in stderr either way |
| WR-03, `--json` mode | `runGate()` throws: `audit-gate.mjs --json did not print parseable JSON on stdout: Unexpected end of JSON input` (the uncaught `ENOENT` printed a Node stack trace to stderr and nothing to stdout) | exit 1, single parseable JSON object, `allowed: false`, non-empty `structuralErrors` |
| WR-03, text mode | First stderr line was `node:fs:1597` (raw Node internals), not `audit-gate: FAIL`; 8 stack-frame lines present | exit 1, first stderr line `audit-gate: FAIL`, 0 stack-frame lines |
| WR-02 | Not reproduced as "slow" by the committed synthetic-tree test itself -- see note below. Reproduced directly instead: `timeout 20 node --test` (zero positional args) run against this repo's REAL `.claude/mcp/vice` directory was killed by the 20-second timeout (`RC=124`) while still executing test 146+ of ~2200, confirming the reviewer's own 15-second measurement | The committed `guardCount: 0` test completes in well under 5000ms (measured ~99ms), and the fixed `checkAuditGate()` never spawns `node --test` at all when `structuralErrors.length > 0` |

**Why the committed WR-02 test does not itself go red pre-fix:** every synthetic tree in this file is built under `mkdtempSync`, so a `guardCount: 0` tree's `viceDir` is a genuinely empty temporary directory with zero files of any kind. Pre-fix, `runGuardsLive(emptyViceDir, [])` still spawns a zero-positional `node --test`, but with nothing in that directory to auto-discover, Node reports "0 tests" and returns in well under 100ms -- the vulnerable code path (spawning a zero-positional `node --test` on a structural failure) is exercised either way, but the SLOWNESS the defect is named for only manifests when that zero-positional spawn runs somewhere with a large, real test tree to discover, which is exactly this repo's actual `.claude/mcp/vice` directory (~2200 tests across many files). The direct reproduction above confirms the defect against that real directory; the committed test locks in the intended fast-path behaviour of the fix (skip the spawn entirely) rather than serving as its own fail-first gate.

## Direct CLI Reproduction (CR-02, per Task 1's acceptance criteria)

```
$ node -e '... writes the exact 10,056-byte payload from 12-VERIFICATION.md to a scratch file ...'
bytes: 10056
$ node scripts/audit-gate.mjs --hook --root <synthetic green tree with 4 passing docs-*.test.ts guards> < <scratch file>
EXIT=0
```
Empty stderr, exit 0, against the real committed fix -- matching the behavior spec's green-tree case exactly.

## Decisions Made

See `key-decisions` in frontmatter. In summary: WR-01 is gated at source level only (no behavioral timeout test, by deliberate choice recorded in this plan's own frontmatter); the depth-truncation signal is returned rather than mutating module state (the file has none and must not acquire any); a depth-truncated payload is IN SCOPE, not automatically REFUSED (the guard verdict still decides); and `isHookInScope()`'s matcher check is kept as defence in depth alongside the new hoisted check in `hookMain()`.

## Deviations from Plan

None - plan executed exactly as written. Every constant name specified in the plan (`MAX_LEAF_DEPTH`, `MAX_LEAF_NODES`, `GUARD_RUN_TIMEOUT_MS`) was implemented under exactly that name with the specified values and semantics. No exported name was renamed, removed, or added — confirmed by `grep -n '^export '` showing the same nine exports as before this plan (`DOCS_GUARD_FLOOR`, `EXPECTED_DOCS_GUARD_NAMES`, `docsGuardFiles`, `runGuardsLive`, `isGatedStatus`, `frontmatterStatus`, `milestoneAuditFiles`, `checkAuditGate`, `writtenDeclaresGatedStatus`, `extractHookTarget`, `isHookInScope`).

## Issues Encountered

- The WR-02 committed test's synthetic `mkdtempSync` tree does not itself reproduce a multi-second stall pre-fix, because its `viceDir` is empty and Node's zero-positional `--test` discovery finds nothing to run there regardless of the fix. Resolved by reproducing the defect directly against this repo's real `.claude/mcp/vice` directory instead (documented above), while keeping the committed synthetic-tree test as a regression guard on the fast-path behaviour going forward. This does not weaken the fix or its verification — the code path exercised is identical; only the wall-clock symptom differs by environment, which is a property of Node's own test-discovery mechanism, not of this fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 12-07 finalizes `12-GATE-PROOF.md`/`12-HOOK-STDIN-EVIDENCE.md` once all gap-closure plans land, and separately owns closing or explicitly accepting the two flagged assumptions (A2: whether a subagent-routed tool call reaches the `--hook` payload; A3: whether a real Bash heredoc's full multi-line body arrives intact in `tool_input.command`) — neither is touched by this plan, since every test here drives the CLI directly.
- The `--hook` exit surface is now exactly {0, 2} across every payload shape exercised in this file (43/43 tests pass), and check mode fails cleanly and diagnosably in both output formats.
- No blockers. The real tree remains green throughout (`node scripts/audit-gate.mjs` prints `audit-gate: OK`, 4 docs guards green, exit 0) and `npm run typecheck` is clean after each task.

---
*Phase: 12-audit-integrity-instrument*
*Completed: 2026-08-21*

## Self-Check: PASSED

- Both modified files confirmed present on disk (`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`).
- All three task commits (`484f05b`, `055c1ef`, `3776810`) confirmed present via `git log --oneline --all`.
- Re-ran `node --test audit-integrity.test.ts` (43/43 pass, `# fail 0`, ~6.0s total) immediately before writing this SUMMARY.
- Re-ran the four `docs-*.test.ts` guards individually and combined (19/19 pass, `# fail 0`).
- Re-ran `node scripts/audit-gate.mjs` on the real tree: `audit-gate: OK -- 4 docs guards green, 6 milestone audits scanned, 4 declaring a gated status`, exit 0.
- Re-ran `node scripts/audit-gate.mjs --root /tmp/definitely-not-a-repo-xyz` (text mode: `audit-gate: FAIL`, 0 stack frames) and with `--json` (parseable JSON, `allowed: false`, non-empty `structuralErrors`).
- Re-ran `npm run typecheck` in `.claude/mcp/vice`: clean.
- Confirmed all nine `export function`/`export const` names in `scripts/audit-gate.mjs` are unchanged from before this plan.
