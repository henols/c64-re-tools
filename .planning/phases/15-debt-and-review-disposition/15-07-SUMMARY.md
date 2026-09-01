---
phase: 15-debt-and-review-disposition
plan: 07
subsystem: testing
tags: [test-isolation, fixture-provenance, test-gate-migration, anno, acme, binmon, debt-disposition]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "plan 15-06's DEBT-02 documentation closes and the phase's shared docs-deferred-ledger.test.ts / docs-review-disposition.test.ts guards"
provides:
  - "build-atomic.test.ts's cleanup-scan assertion is scoped to a private per-run wrapper directory, immune to any of the ten other build()-calling test files planting a .build-tmp-* sibling in the shared system temp root"
  - "cpuhistory-get.json and cpuhistory-get-multi.json correctly record capturedFrom: fork:/usr/local/bin/x64sc (was mislabelled stock); fixtures README documents the kind token is operator-supplied, not derived"
  - "anno-cli.test.ts, anno-project.test.ts and disasm-roundtrip.test.ts import their ACME/analyser availability gates from anno-test-gate.ts instead of carrying local copies; the seam's HONEST SCOPE paragraph (which documented this exact migration as outstanding) is deleted"
  - "Three pending todos closed with cited, re-verified Resolutions in .planning/todos/completed/"
affects: [15-09, 15-11, 15-12]

actuals:
  tokens: 9300
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Planted-violation proof for a test-isolation flake (Task 1): rather than trust a single green run, a directory named with the exact colliding prefix was planted directly in the shared system temp root both before and after the fix, confirming the assertion reddens pre-fix and passes post-fix against the identical external condition."
    - "Baseline-then-migrate discipline for a test-gate consolidation (Task 3): pass/fail/total counts for every migrated file were measured BOTH before touching any source (via a saved git diff patch, git checkout -- to the pre-migration tree, then reapplying the patch) and after, in both the default and opt-in-environment-variable configurations, so the migration's own acceptance bar (no changed pass count) is a measured fact rather than an assumption from a post-fix-only run."
    - "Live re-measurement over inherited claims (Task 2): the fixture-mislabel finding's own claim that /usr/local/bin/x64sc is the fork build was re-verified this session (--help mcpserver mention counts: fork 5, stock 0) rather than copied forward from the todo's prior citation."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/build-atomic.test.ts
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.json
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json
    - .claude/mcp/vice/fixtures/binmon/README.md
    - .claude/mcp/vice/anno-test-gate.ts
    - .claude/mcp/vice/anno-cli.test.ts
    - .claude/mcp/vice/anno-project.test.ts
    - .claude/mcp/vice/disasm-roundtrip.test.ts
    - .planning/todos/completed/2026-08-22-build-atomic-cleanup-test-races-on-shared-tmp.md (moved from pending/)
    - .planning/todos/completed/2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md (moved from pending/)
    - .planning/todos/completed/2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md (moved from pending/)
    - .planning/STATE.md

key-decisions:
  - "Task 2's named follow-on (deriving CAPTURE_BACKEND_KIND automatically from resolvedBackend() instead of trusting an operator-typed env var) was deliberately NOT implemented here -- it would touch probe-binmon.mjs, which plan 15-05 already recorded as evidence-immutable for 13-REVIEW.md WR-02. Promoted to a named follow-on (owner: whichever future plan next edits probe-binmon.mjs's capture path) per DEBT-01's three-outcome criterion, rather than silently widening this plan's scope."
  - "Task 3's timeout divergence (two of three local ACME probe copies passed no spawnSync timeout; the seam passes 10s) was resolved by converging on the seam's bounded probe, exactly as the todo instructed -- this is a behavior change (an unbounded probe becomes bounded) but was accepted as in-scope since it is the exact drift the seam exists to stop, not a new capability."
  - "A mid-plan process defect was caught and fixed rather than silently left: a multi-path `git add` invocation aborted before staging two files because one stale pathspec in the same command failed to match, silently dropping the todo Resolution content and a STATE.md ledger edit from commit 6def094 (0 insertions committed despite substantial unstaged content). Caught immediately via post-commit `git show --stat` verification and corrected in a follow-up commit (40246ef) that lands the content the prior commit's message described, rather than leaving the discrepancy for a later plan to discover."

patterns-established:
  - "Multi-path `git add` with one stale/already-moved pathspec aborts the WHOLE command silently for a Claude Code executor (no partial staging) -- verify `git status --short` after any multi-path add that follows a `git mv`, since the mv already changed what paths exist on disk."

requirements-completed: []

coverage:
  - id: D1
    description: "Task 1: build-atomic.test.ts's cleanup-scan assertion scoped to a private mkdtempSync() wrapper directory instead of directly under os.tmpdir(), immune to the ten other build()-calling test files (several building into their own tmpdir()-scoped scratch dirs)."
    requirement: null
    verification:
      - kind: unit
        ref: "build-atomic.test.ts (all 6 tests), 3 consecutive runs, all 6/6 pass"
        status: pass
      - kind: other
        ref: "planted-violation proof: mkdir /tmp/.build-tmp-planted-probe-* directly in the shared temp root -- reddens the pre-fix code (not ok 3, actual: ['.build-tmp-planted-probe-12345']), passes the post-fix code (ok 3) against the identical planted directory"
        status: pass
      - kind: unit
        ref: "npm run test:automated, 2 consecutive runs, both 2110 tests / 2105 pass / 0 fail / 5 todo (unchanged from 15-06's recorded baseline)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: cpuhistory-get.json and cpuhistory-get-multi.json's capturedFrom kind corrected from stock to fork; fixtures README table and a new operator-supplied-kind note updated to match; the correctly-labelled sibling (cpuhistory-get-unsupported.json) left untouched."
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'fork:' on both files returns 1 each; grep -l 'stock:/usr/local/bin' *.json returns 0 matches; git diff --stat on cpuhistory-get-unsupported.json is empty; git diff on each edited file shows exactly one changed line"
        status: pass
      - kind: other
        ref: "live re-measurement this session: /usr/local/bin/x64sc --help mentions -mcpserver 5 times (fork); /usr/bin/x64sc --help mentions it 0 times (genuine stock)"
        status: pass
      - kind: unit
        ref: "binmon-fixtures.test.ts, 32/32 pass; confirmed EXTV-01's capturedFrom-by-name assertion is scoped to display-get/event-interleaved/checkpoint-list only, never reaching these two files"
        status: pass
    human_judgment: false
  - id: D3
    description: "Task 3: anno-cli.test.ts, anno-project.test.ts, and disasm-roundtrip.test.ts's local ACME/analyser gate copies replaced with imports from anno-test-gate.ts; the seam's stale HONEST SCOPE paragraph deleted; the unbounded-probe timeout divergence converged on the seam's bounded 10s spawnSync."
    requirement: null
    verification:
      - kind: unit
        ref: "measured before/after pass-count table across all four files (anno-cli.test.ts, disasm-roundtrip.test.ts, absorbed-answer-key.test.ts as unmigrated control, anno-project.test.ts), both default and VICE_REQUIRE_ANNO=1 VICE_REQUIRE_ACME=1 opt-in runs -- every cell identical pre- and post-migration (64/64/0/0, 5/5/0/0, 10/10/0/0, 13/13/0/0; combined 92/92/0/0)"
        status: pass
      - kind: unit
        ref: "anno-cli.test.ts test 35 (11-VERIFICATION.md's cited criterion-3 evidence) reports identical name and ok verdict before and after, under the opt-in run"
        status: pass
      - kind: unit
        ref: "npm run typecheck exits 0; npm run test:automated 2110/2105/0/5, unchanged"
        status: pass
      - kind: other
        ref: "grep confirms no local probeAcme/probeAnno/ACME_AVAILABLE/ANNO_AVAILABLE definitions remain in the three migrated files; HONEST SCOPE absent from anno-test-gate.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "All three todos moved pending/ -> completed/ with cited ## Resolution sections; STATE.md's Deferred Items ledger reconciled in the same commit as each move."
    requirement: null
    verification:
      - kind: unit
        ref: "test -f completed/<name> and test ! -f pending/<name> for all three; grep -c '^## Resolution' == 1 for all three"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts (4/4 and 11/11 pass, both directions)"
        status: pass
    human_judgment: false

duration: 55min (approx.)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 7: Fix Three Genuinely Cheap Pending Todos (Test Isolation, Fixture Mislabel, Gate Migration) Summary

**Fixed a test-isolation flake by scoping build-atomic.test.ts's cleanup scan to a private wrapper directory, corrected two cpuhistory-get* fixture sidecars that mislabelled the fork binary as stock, and migrated three hand-copied ACME/analyser test gates onto the shared anno-test-gate.ts seam — all three proven by planted violations or measured before/after baselines, never a single green run, with no migrated file's pass count changed.**

## Performance

- **Duration:** 55 min (approx.)
- **Started:** 2026-08-22T17:30:00Z (approx.)
- **Completed:** 2026-08-22T16:31:08Z (commit timestamp, local +02:00)
- **Tasks:** 3 completed
- **Files modified:** 12 (8 source/fixture files, 3 todos moved, 1 STATE.md, across 7 commits)

## Accomplishments

- **Task 1 (test-isolation flake):** `build-atomic.test.ts`'s `tempSiblingsOf()` scan was rescoped from the shared `os.tmpdir()` (via `dirname(outDir)`, where `outDir` itself lived directly under `tmpdir()`) to a private `mkdtempSync()` wrapper directory holding both the success and failure out-dirs. Proven non-vacuous with a planted violation: a directory named `.build-tmp-planted-probe-*` created directly in `/tmp` reddened the pre-fix assertion (`actual: ['.build-tmp-planted-probe-12345']`) and was invisible to the post-fix assertion (green) against the identical plant. Confirmed the ten-file `build()` concurrency surface by direct grep (`grep -rl "from \"./build.ts\"" *.test.ts`): `broker-control.test.ts`, `broker-e2e.test.ts`, `broker-kill.test.ts`, `broker-launch.test.ts`, `resources-sync.test.ts` (the sharpest collision — its own scratch dir is also `mkdtempSync(tmpdir())`-rooted), `stock-broker-live.test.ts`, `stock-live-broker-monitor.test.ts`, `vice-broker-acquire.test.ts`, `vice-broker-launch.test.ts`, `vice-broker-supervision.test.ts`.
- **Task 2 (fixture mislabel):** `cpuhistory-get.json` and `cpuhistory-get-multi.json`'s `capturedFrom` corrected from `stock:/usr/local/bin/x64sc` to `fork:/usr/local/bin/x64sc` — kind token only, one changed line per file, bytes and path unchanged. Re-measured the binary identity live this session rather than trusting the finding's own citation: `/usr/local/bin/x64sc --help` names `-mcpserver` 5 times (fork), `/usr/bin/x64sc --help` names it 0 times (genuine stock — the correctly-labelled sibling `cpuhistory-get-unsupported.json`'s own path, left untouched). Confirmed no test asserts either file's `capturedFrom` by literal name (`binmon-fixtures.test.ts`'s `EXTV-01` test is scoped to exactly `display-get`/`event-interleaved`/`checkpoint-list`). Fixtures README's provenance table rows corrected and a new note added recording that the kind token is operator-supplied (`CAPTURE_BACKEND_KIND`), not derived — the root cause named as a follow-on rather than fixed, since deriving it would touch `probe-binmon.mjs`, which plan 15-05 already marked evidence-immutable for `13-REVIEW.md WR-02`.
- **Task 3 (gate migration):** `anno-cli.test.ts` (which carried both a `probeAnno()` and a `probeAcme()` local copy), `anno-project.test.ts` (a third, independently-divergent `probeAnno()` copy — confirmed present, correcting the todo's original two-file scope), and `disasm-roundtrip.test.ts` (the file that established the ACME convention originally) now import `ANNO_BIN`/`skipReasonFor`/`assertAnnoRequiredIfEnvSet` and/or `ACME_BIN`/`acmeSkipReasonFor`/`assertAcmeRequiredIfEnvSet` from `anno-test-gate.ts`. The timeout divergence the todo named (two local `probeAcme()` copies passed no `spawnSync` timeout; the seam passes 10s) is resolved by converging on the seam's bounded probe. `anno-test-gate.ts`'s stale HONEST SCOPE paragraph — which documented exactly this migration as outstanding — is deleted.
- **Migration proven non-regressive by a measured before/after table**, not a single post-fix run: the pre-migration tree was captured (`git diff` saved to a patch, `git checkout --` the four files, both default and `VICE_REQUIRE_ANNO=1 VICE_REQUIRE_ACME=1` opt-in counts measured), then the migration patch was reapplied and re-measured. Both the external analyser (0.9.20) and ACME (0.97 "Zem") are genuinely installed on this host, so all four cells below are independent proof, not duplicate skip paths:

  | File | Default (before → after) | Opt-in (before → after) |
  |---|---|---|
  | `anno-cli.test.ts` | 64/64/0/0 → 64/64/0/0 | 64/64/0/0 → 64/64/0/0 |
  | `disasm-roundtrip.test.ts` | 5/5/0/0 → 5/5/0/0 | 5/5/0/0 → 5/5/0/0 |
  | `absorbed-answer-key.test.ts` (unmigrated control) | 10/10/0/0 → 10/10/0/0 | 10/10/0/0 → 10/10/0/0 |
  | `anno-project.test.ts` | 13/13/0/0 → 13/13/0/0 | 13/13/0/0 → 13/13/0/0 |
  | combined | 92/92/0/0 → 92/92/0/0 | 92/92/0/0 → 92/92/0/0 |

  `11-VERIFICATION.md`'s cited `anno-cli.test.ts` test 35 ("criterion 3 … renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` … reassembles under real ACME") reports identical name and `ok` verdict before and after, under the opt-in run.
- **Process note, corrected in-plan:** a multi-path `git add` command aborted silently after `git mv`-ing a todo when one of its three pathspecs (the now-nonexistent pre-move `pending/` path) failed to match — this dropped Task 2's Resolution text and STATE.md ledger edit from commit `6def094` (which landed as an empty-content rename only). Caught immediately by a post-commit `git show --stat` check showing `0 insertions` where substantial content was expected, and corrected in follow-up commit `40246ef` before proceeding to Task 3. Lesson recorded in `patterns-established`.
- All three todos moved `pending/` → `completed/` with cited `## Resolution` sections naming the closing commit, the proof method, and (Task 2) a named follow-on owner. `STATE.md`'s Deferred Items ledger reconciled in the same commit as each move (pending 15 → 12 across the three closes; total 16 → 13); one historical-prose mention of Task 3's own todo stem was reworded to a paraphrase (matching the existing pattern for the fork-backend-removal todo) so `docs-deferred-ledger.test.ts`'s completed-stem check does not trip.
- **DEBT-01 is NOT marked complete** — it is a shared requirement ID still declared by sibling plans 15-09, 15-11 and 15-12 per the shared-ID gate (#2388); `requirements.ready-ids` correctly withholds it. Likewise DEBT-02 is untouched by this plan (already partially closed by 15-06, remainder owned by 15-09).

## Task Commits

1. **Task 1: Scope build-atomic.test.ts's cleanup scan to a private parent** - `7484afa` (fix), `f663a97` (docs: close todo + STATE.md ledger)
2. **Task 2: Correct the two cpuhistory-get sidecars' provenance labels** - `d67f0ef` (fix), `6def094` (docs: close todo, rename-only due to the git-add process defect), `40246ef` (docs: land the dropped Resolution content + STATE.md ledger)
3. **Task 3: Migrate the hand-copied ACME/analyser gates** - `185187a` (fix), `4ea813d` (docs: close todo + STATE.md ledger)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.claude/mcp/vice/build-atomic.test.ts` - cleanup-scan test rescoped to a private `mkdtempSync()` wrapper directory
- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get.json` - `capturedFrom` corrected `stock` → `fork`
- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json` - `capturedFrom` corrected `stock` → `fork`
- `.claude/mcp/vice/fixtures/binmon/README.md` - provenance table rows corrected; new operator-supplied-kind note added
- `.claude/mcp/vice/anno-test-gate.ts` - HONEST SCOPE paragraph deleted, header updated to name all three consumers
- `.claude/mcp/vice/anno-cli.test.ts` - local `probeAnno()`/`probeAcme()` copies replaced with seam imports
- `.claude/mcp/vice/anno-project.test.ts` - local `probeAnno()` copy replaced with seam imports
- `.claude/mcp/vice/disasm-roundtrip.test.ts` - local `probeAcme()` copy replaced with seam imports
- `.planning/todos/completed/2026-08-22-build-atomic-cleanup-test-races-on-shared-tmp.md` - moved from `pending/`; `## Resolution` cites `7484afa`
- `.planning/todos/completed/2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md` - moved from `pending/`; `## Resolution` cites `d67f0ef`
- `.planning/todos/completed/2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md` - moved from `pending/`; `## Resolution` cites `185187a`
- `.planning/STATE.md` - Deferred Items ledger reconciled across all three closes (pending 15 → 12, total 16 → 13); one historical stem-mention reworded

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) Task 2's derive-the-kind-automatically follow-on deliberately not implemented, since it would touch the evidence-immutable `probe-binmon.mjs` — promoted with a named owner instead; (2) Task 3's timeout divergence resolved by converging on the seam's 10s bound, exactly as the todo instructed; (3) a mid-plan `git add` process defect (stale pathspec aborting a multi-path add) was caught via post-commit verification and corrected in a follow-up commit rather than left for discovery later.

## Deviations from Plan

None from the plan's own instructions — all three tasks executed exactly as specified, including the explicit re-verification steps (binary identity re-measurement, baseline-then-migrate pass counts, ten-file concurrency surface confirmation) the plan called for.

One in-session process correction (not a plan deviation under Rules 1-4, since it corrected the executor's own tooling mistake rather than the plan's content): commit `6def094` landed without its intended content due to a multi-path `git add` aborting on a stale pathspec; corrected in `40246ef` before Task 3 began. No plan task was skipped, weakened, or left incomplete as a result — the correction was caught and applied within Task 2's own scope.

## Issues Encountered

None beyond the git-add process note above, which was self-resolved within the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Three of the phase's genuinely-cheap pending todos are closed with cited, re-verified Resolutions. `docs-deferred-ledger.test.ts` and `docs-review-disposition.test.ts` both run green (4/4, 11/11). `npm run test:automated` reconfirmed at 2110 tests / 2105 pass / 0 fail / 5 pre-existing todo, unchanged from before this plan, across two consecutive runs. `build-atomic.test.ts` is immune to concurrent `build()` callers (proven by planted violation), the two `cpuhistory-get*` fixtures correctly identify their capturing binary, and five consumers now share one test-gate implementation with a bounded probe. DEBT-01 remains open pending sibling plans 15-09/15-11/15-12's own dispositions of their assigned todos. No blockers for the remaining phase 15 plans.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All modified files confirmed present on disk with expected content: `build-atomic.test.ts` (private wrapper present, 6/6 tests pass x3), both `cpuhistory-get*.json` files (`capturedFrom` starts with `fork:`), `fixtures/binmon/README.md` (fork mentions present, operator-supplied note added), `anno-test-gate.ts` (HONEST SCOPE absent), all three migrated test files (no local probe definitions remain, seam imports present), all three completed todos (each with exactly one `## Resolution` heading citing a resolvable commit sha: `7484afa`, `d67f0ef`, `185187a` — all confirmed present in `git log --oneline --all`), `STATE.md` (12 pending todos on disk matches the ledger's stated count). Plan-level `<verification>` re-run: `npm run typecheck` exits 0; `npm run test:automated` exits 0 on two consecutive runs (2110/2105/0/5 both times); `node --test build-atomic.test.ts` exits 0 on three consecutive runs (6/6 each); the opt-in run of all four the external analyser/ACME test files matches the pre-migration baseline cell for cell; all three todos confirmed in `.planning/todos/completed/`, none remaining in `.planning/todos/pending/`.
