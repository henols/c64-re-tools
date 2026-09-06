---
phase: 38-proof-01-03-on-real-cracked-code
fixed_at: 2026-09-06T09:44:41Z
review_path: .planning/phases/38-proof-01-03-on-real-cracked-code/38-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 38: Code Review Fix Report

**Fixed at:** 2026-09-06T09:44:41Z (initial pass 2026-09-06T09:40:26Z; WR-02 residual-gap follow-up landed 2026-09-06T09:44:41Z per orchestrator verification)
**Source review:** .planning/phases/38-proof-01-03-on-real-cracked-code/38-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; fix_scope=all, 0 Info findings present)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Stale line citation baked into a printed evidence string

**Files modified:** `src/mcp/vice/dxa-proof01-compare.ts`
**Commit:** `45a185f9`
**Applied fix:** Re-derived the correct range against the current source with `grep -n` before touching anything (per project-specific execution notes), rather than trusting the review's quoted range verbatim. Confirmed the `ByteDerivedPartition` doc block in `dxa-partition.ts` spans lines 463-467 (line 462 is blank; `/**` opens at 463, `*/` closes at 467) — this matched the review's own re-derived range exactly. Corrected both citations from `dxa-partition.ts:462-464` to `dxa-partition.ts:463-467`: the module-header comment (line 16) and the exported `PROOF01_FALSE_POSITIVES_REFUSAL` string constant (line 61).

**Consumer sweep (per execution notes):** Grepped the whole repo for `PROOF01_FALSE_POSITIVES_REFUSAL` and for the literal citation text `dxa-partition.ts:462-464`. Consumers found and their disposition:
- `src/mcp/vice/dxa-proof01-compare.test.ts` — imports and asserts against the constant via a regex built from the constant itself (`PROOF01_FALSE_POSITIVES_REFUSAL.replace(...)`), so it automatically tracks the corrected string with no edit needed. Verified: still 7/7 passing (6 pre-existing + 1 added under WR-03).
- `src/mcp/vice/proof-evidence-integrity.test.ts` — only asserts a `/^structurally-uncomputable/` prefix regex, never the full string with the citation, so it is unaffected either way. No edit needed.
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md` and `evidence/SCHEMA.md` — these are committed, historical evidence artifacts: frozen transcripts of what the code actually printed during real measurement runs (`SCHEMA.md` was committed before the six measurement commits per the phase's own evidence-integrity discipline, per `STATE.md`). Rewriting their content now would misrepresent what the code that generated them actually emitted at the time — the citation bug is documentation-accuracy only and does not touch any recorded measurement (`PROOF01_DATA_RECOVERY_PCT`, `PROOF01_FALSE_POSITIVES`, etc. are all unaffected). **Left unchanged, deliberately** — any future PROOF-01 re-run will emit the corrected citation going forward. This is a judgment call, not a mechanical requirement of the fix; flagging for owner review if retroactive correction of the evidence transcript is wanted.
- `.planning/phases/38-proof-01-03-on-real-cracked-code/38-01-PLAN.md`, `38-RESEARCH.md`, `38-PATTERNS.md`, `38-01-SUMMARY.md`, `.planning/STATE.md` — historical planning/narrative artifacts describing the same stale citation as prose. Out of scope for a source-code fixer pass (not source, not tests); left unchanged for the same reason as the evidence files above.

**Verification:** Tier 1 (re-read both edited spots, confirmed intact) + Tier 2 (`npx tsc --noEmit` clean on the file; `node --test dxa-proof01-compare.test.ts` 6/6 passing at the time of this fix, later 7/7 once WR-03 landed).

### WR-02: The filesystem/process-spawn structural guard uses narrow regexes that miss bare-specifier and dynamic-import forms

**Files modified:** `src/mcp/vice/dxa-proof01-compare.test.ts`
**Commits:** `d8ea8859` (initial fix), `6940b6c9` (residual-gap follow-up, see below)
**Applied fix (initial, `d8ea8859`):** Replaced the five regex patterns (which only matched `node:`-prefixed static `from` imports and one `require()` shape) with a plain substring/bare-name check over four banned tokens (`child_process`, `node:fs`, `"fs"`, `'fs'`), mirroring `dxa-listing.test.ts`'s own broader guard as the review suggested. This substring approach uniformly catches bare specifiers (`from "fs"`), `require("node:fs")`, and any dynamic `import(...)` form that the five original regexes missed. Confirmed no false-positive substring collisions against the module's own source first (`grep -n` for the four banned tokens returned nothing before the edit).

**Residual gap found in orchestrator verification, corrected (`6940b6c9`):** The initial fix's two fs entries, `'"fs"'` and `"'fs'"`, were CLOSED quote pairs — they only matched a bare module specifier exactly equal to `"fs"`, so a bare **subpath** specifier such as `"fs/promises"` or `'fs/promises'` still slipped through undetected in static, `require`, and dynamic-`import` shapes alike (the review's own suggested fix in `38-REVIEW.md` carried this same flaw; not a deviation introduced during the fix). Corrected by replacing the closed-pair entries with OPEN-quote-prefix entries — `'"fs` (opening double-quote immediately followed by `fs`, no closing quote required) and `"'fs"` (opening single-quote immediately followed by `fs`) — so every real fs specifier, bare `"fs"` or any subpath like `"fs/promises"`, matches with one entry per quote style. `node:fs` was already a substring of both `node:fs` and `node:fs/promises`, so the `node:`-prefixed forms needed no change.

Verified against 6 probe cases before committing the follow-up:
| Probe | Result |
|---|---|
| `import {x} from "fs/promises";` | CAUGHT (`"fs`) |
| `import {x} from 'fs/promises';` | CAUGHT (`'fs`) |
| `import {x} from "fs";` | CAUGHT (`"fs`) |
| `await import("fs")` | CAUGHT (`"fs`) |
| `import {x} from "node:fs/promises";` | CAUGHT (`node:fs`) |
| `require("child_process")` | CAUGHT (`child_process`) |

Also re-ran `grep` for the four new/changed tokens against the module's own real source (`dxa-proof01-compare.ts`) to confirm zero false-positive collisions before and after, and re-ran the full test file to confirm no false-positive trip against the module's legitimate source.

**Verification:** Tier 1 (re-read the replaced block, both times) + Tier 2 (`npx tsc --noEmit` clean, both times; `node --test dxa-proof01-compare.test.ts` — 6/6 after the initial fix, 7/7 after WR-03 landed and again after the follow-up — all passing against the real, guard-compliant module source with no false positive).

### WR-03: No test exercises a non-empty `certainCode`, so the denominator formula's second term is unverified

**Files modified:** `src/mcp/vice/dxa-proof01-compare.test.ts`
**Commit:** `31b6ef57`
**Applied fix:** Added a new test (`"denominator sums certainCode.size and certainData.size, not certainData.size alone"`) using the review's suggested fixture (`makeGroundTruth([0x0801], [0x0900, 0x0901])`, non-empty `certainCode`), asserting `comparison.denominator === 3`.

**Extra verification beyond the standard 3-tier strategy:** Before committing, temporarily mutated `dxa-proof01-compare.ts:122` to the buggy formula (`denominator = groundTruth.certainData.size` alone, dropping the `certainCode.size` term) and re-ran the suite — the new test failed exactly as expected (`actual: 1, expected: 3`), confirming the test is not vacuously true. Restored the source via `git checkout --` (clean revert, verified `git status`/`git diff` showed zero changes to the source file) and re-ran the suite to confirm all 7 tests pass again against the real, correct formula before committing only the test-file change.

**Verification:** Tier 1 (re-read the added test) + Tier 2 (`npx tsc --noEmit` clean; `node --test dxa-proof01-compare.test.ts` 7/7 passing) + the regression-catching check above (logic-bug class per `verification_strategy` — this is a test-only addition, not a change to production logic, so no human-verification flag is needed; the added assertion's correctness was directly proven by the induced-failure check).

## Skipped Issues

None — all 3 in-scope findings were fixed.

## Additional Verification (whole-suite, per execution notes)

**Pass 1** — ran from `src/mcp/vice` inside the first isolated worktree (`gsd-reviewfix/38-<pid1>`) after commits `45a185f9`, `d8ea8859`, `31b6ef57`:
- `node --test dxa-proof01-compare.test.ts` → 7/7 pass (0 fail)
- `node --test hostpath-consumers.test.ts` → 22/22 pass (0 fail)
- `npx tsc --noEmit` (project-wide, via a temporary `node_modules` symlink into the worktree pointing at the main checkout's `node_modules` — removed again immediately after the check) → exit code 0, clean.

**Pass 2** — orchestrator verification found the WR-02 residual gap (bare `fs/promises` specifier); ran the same checks again from a second isolated worktree (`gsd-reviewfix/38-<pid2>`) after commit `6940b6c9`, then a third time from the main checkout directly (after the cleanup tail fast-forwarded `main`):
- `node --test dxa-proof01-compare.test.ts` → 7/7 pass (0 fail), both in the worktree and from the main checkout afterward
- `node --test hostpath-consumers.test.ts` → 22/22 pass (0 fail), both in the worktree and from the main checkout afterward
- `npx tsc --noEmit` → exit code 0, clean, both in the worktree (via the same temporary-symlink technique) and from the main checkout afterward (real `node_modules`, no symlink needed)

Full `npm test` glob was deliberately NOT run per the project-specific execution notes (it blocks indefinitely on `vice-proxy.test.ts`).

**Note on where gates ran:** all fixes and verification ran inside isolated worktrees (per `workflow.use_worktrees: true`), never in the main checkout while uncommitted changes were in flight. Neither worktree had a committed `node_modules`; the `tsc --noEmit` checks borrowed the main checkout's `node_modules` via a temporary symlink created and then `rm`'d immediately after each check (a plain symlink on Linux — `rm` does not traverse into it, so the main checkout's real `node_modules` directory was never touched). After each cleanup tail fast-forwarded `main` and removed its worktree, the same commands were re-run directly from the main checkout to confirm reproducibility with no symlink involved — both re-runs (in this report's Pass 1 and Pass 2) were clean.

---

_Fixed: 2026-09-06T09:44:41Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
