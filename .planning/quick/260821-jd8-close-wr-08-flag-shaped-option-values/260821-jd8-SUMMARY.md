---
phase: quick-260821-jd8
plan: 01
subsystem: r2000
tags: [regenerator2000, cli, input-validation, security, wr-08]

requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: the r2000-cli.ts CLI ergonomics layer (parseArgs(), bootstrapProject(),
      cmdBootstrap/cmdExportAsm/cmdVerify) this task patches
provides:
  - "parseArgs() refuses a missing or flag-shaped --entry/--out value instead of silently taking it"
  - "10-SECURITY.md flipped to threats_open: 0 / status: verified (T-10-19 assigned to WR-08)"
affects: [r2000-cli, phase-10-security]

tech-stack:
  added: []
  patterns:
    - "Reused parseExportLblArgs()'s existing missing/flag-shaped-value guard shape for parseArgs(), rather than inventing a third convention in the same file"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts
    - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-SECURITY.md
    - .planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md (moved to completed/)
    - .planning/STATE.md

key-decisions:
  - "parseArgs() gained entryMissingValue/outMissingValue boolean flags (mirroring parseExportLblArgs()'s outMissingValue) rather than throwing or returning a discriminated union, keeping the same destructuring shape every existing caller already uses"
  - "Refusal checks were placed in each of the three cmd* functions (cmdBootstrap, cmdExportAsm, cmdVerify) immediately after destructuring parseArgs()'s result, before any filesystem access, so bootstrapProject()'s never-throw contract is never at risk"
  - "verify's --out case was NOT given a dedicated test, since checkAcceptedOptions() already refuses --out for verify (it is not in VERB_OPTIONS.verify) before parseArgs() is ever reached — that path is already pinned by the pre-existing IN-06 'verify: --out is refused' test; testing it again here would just re-prove IN-06, not WR-08"

requirements-completed: []

duration: ~40min (commit span 3541886 -> d007d68)
completed: 2026-08-21
---

# Quick Task 260821-jd8: Close WR-08 — Flag-Shaped and Missing Option Values Summary

**`parseArgs()` in `r2000-cli.ts` now refuses a missing or `--`-shaped value for `--entry`/`--out` across `bootstrap`/`export-asm`/`verify`, closing 10-REVIEW.md's WR-08 (assigned T-10-19) and flipping `10-SECURITY.md` to `threats_open: 0` / `status: verified`.**

## Performance

- **Duration:** commit span `3541886` → `d007d68` (3 commits)
- **Tasks:** 3
- **Files modified:** 5 (2 code/test, 3 docs — one docs file created new on disk despite being tracked as a Phase 10 deliverable, since `10-SECURITY.md` had never been committed before this task; see Issues Encountered)

## Accomplishments

- **WR-08 / T-10-19 closed:** `parseArgs()` (`r2000-cli.ts`) previously did `entry = rest[++i]` / `out = rest[++i]` unconditionally. It now checks whether the following token is `undefined` or itself starts with `--`, and if so sets `entryMissingValue`/`outMissingValue` instead of taking it as the value — the exact guard shape `parseExportLblArgs()` already used for `--out`, reused rather than reinvented. `cmdBootstrap()`, `cmdExportAsm()` and `cmdVerify()` (the three verbs sharing `parseArgs()`) each check the relevant flag(s) immediately after destructuring, before any filesystem access, and refuse with a one-line `<verb>: --{entry,out} requires a value` message plus USAGE — never a throw, preserving `bootstrapProject()`'s never-throw contract.
- **The message speaks the caller's vocabulary (WR-09's lesson):** `bootstrap x.prg --out --entry FOO` now says `bootstrap: --out requires a value`, never blaming `--entry`. Confirmed live (see transcript below).
- **10 new pinning tests** added to `r2000-cli.test.ts`: the review's own literal reproduction for both `bootstrap` and `export-asm` (each asserting the actual harm — no file literally named `--entry` is created, at the real landing spot, `process.cwd()`), plus missing-value and flag-shaped-value cases for both options across `bootstrap`/`export-asm`, and `--entry`'s two cases for `verify`.
- **10-SECURITY.md closed:** frontmatter flipped `status: issues_found` → `verified`, `threats_open: 1` → `0`, `threats_total: 24` → `25`. The unregistered WR-08 row is replaced with a real `T-10-19` register entry (disposition `mitigate`, status `CLOSED`, citing the fix and test commits), and the "WR-08 — live re-reproduction and severity assessment" section gained a `## Resolution` paragraph.
- **Pending todo closed:** `.planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md` moved to `.planning/todos/completed/` with a `## Resolution` section naming this quick task and both commits.
- **STATE.md kept in sync:** Deferred Items table row removed, item count corrected 18→17, the enumeration prose updated, and "Current Position"/"Quick Tasks Completed" updated to record the closure. Both ledger guards (`docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`) re-run green after the move.

## Task Commits

1. **Task 1: Refuse a missing or flag-shaped value for --entry and --out** — `3541886` (fix)
2. **Task 2: Pin it across both options and all three verbs** — `e0fd305` (test)
3. **Task 3: Flip 10-SECURITY.md and close the todo** — `d007d68` (docs)

## Files Created/Modified

- `.claude/mcp/vice/r2000-cli.ts` — `parseArgs()` rewritten with `entryMissingValue`/`outMissingValue` flags; `cmdBootstrap()`, `cmdExportAsm()`, `cmdVerify()` each check the relevant flag(s) before touching the filesystem
- `.claude/mcp/vice/r2000-cli.test.ts` — 10 new tests in a new "WR-08" section (2 literal-reproduction cases with cwd-hazard assertions plus defensive cleanup, 4 bootstrap missing/flag-shaped cases, 4 export-asm missing/flag-shaped cases already counted, 2 verify `--entry` cases)
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-SECURITY.md` — frontmatter flipped to `verified`/`threats_open: 0`/`threats_total: 25`; WR-08 row replaced with T-10-19 (CLOSED); Resolution paragraph appended to the WR-08 detail section
- `.planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md` → moved to `.planning/todos/completed/`, with a `## Resolution` section appended
- `.planning/STATE.md` — Deferred Items table/prose updated (18→17 items), Current Position section records the T-10-19 closure and fixes a pre-existing garbled "Last activity" line left over from quick task 260821-a86, Quick Tasks Completed table gained a new row

## Decisions Made

- Reused `parseExportLblArgs()`'s existing `outMissingValue`-style guard rather than inventing a third option-parsing convention in the same file (per the plan's explicit instruction).
- Placed refusal checks in each `cmd*` function rather than centralizing them inside `parseArgs()` itself (which cannot print verb-specific messages or call `process.exit`), matching how `parseExportLblArgs()`'s caller (`cmdExportLbl()`) already does its own check-and-refuse.
- Did not add a dedicated `verify --out` missing/flag-shaped test, since `checkAcceptedOptions()` already refuses `--out` for `verify` (not in `VERB_OPTIONS.verify`) before `parseArgs()` is ever reached — pinned already by the pre-existing "verify: --out is refused" IN-06 test. Adding a redundant test here would test IN-06 again, not WR-08.
- For `verify`'s flag-shaped `--entry` test, used `--entry --entry` (the value is itself `--entry`) rather than an arbitrary flag like `--force`, since `verify`'s accepted-option set is `["--entry"]` only — any other flag-shaped "value" would be caught by `checkAcceptedOptions()` first (as an unrecognized option) rather than exercising `parseArgs()`'s own flag-shaped-value detection.
- Corrected the two literal-reproduction tests' harm assertion mid-task, after discovering during the non-vacuity proof that the real hazard file lands at `process.cwd()` (a directory-less relative `outPath`), not inside the test's own temp directory — the original `join(dir, "--entry")` assertion would have passed even against the pre-fix parser for the wrong reason. Corrected to `join(process.cwd(), "--entry")` with defensive `finally`-block cleanup, matching this project's "assert the actual harm" requirement precisely.

## Deviations from Plan

None requiring a Rule 1-4 classification — one **test-design correction** during the non-vacuity proof (Task 2), described above and in the transcript below, is worth flagging as a positive outcome of the required non-vacuity exercise rather than a plan deviation: it caught the test's own assertion checking the wrong filesystem location before the fix was ever committed.

**Total deviations:** 0 auto-fixed (0 Rule 1/2/3, 0 Rule 4)
**Impact on plan:** None. All three tasks landed as scoped; scope boundary (no other option parsers, no Phase 4 disassembler family) was respected.

## Non-Vacuity Proof (transcript, as required)

`parseArgs()` was reverted in place to the pre-fix `entry = rest[++i]` / `out = rest[++i]` form (interface fields kept, hardcoded to `false`, so the file still type-checked), then the full test run:

```
$ npx tsc --noEmit    # exit 0 (revert type-checks)
$ node --test r2000-cli.test.ts
not ok 55 - bootstrap: the review's literal reproduction (--out --entry FOO) ...
not ok 56 - bootstrap: --entry with no following token is refused ...
not ok 57 - bootstrap: --entry followed by a flag-shaped token is refused ...
not ok 58 - bootstrap: --out with no following token is refused ...
not ok 59 - export-asm: the review's finding, one verb over (--out --entry FOO) ...
not ok 60 - export-asm: --entry with no following token is refused ...
not ok 61 - export-asm: --entry followed by a flag-shaped token is refused ...
not ok 62 - export-asm: --out with no following token is refused ...
not ok 63 - verify: --entry with no following token is refused ...
not ok 64 - verify: --entry followed by a flag-shaped token is refused ...
# tests 64
# pass 54
# fail 10
```

Test 55's failure detail: `error: 'Expected "actual" to be strictly unequal to: 0' ... expected: 0, actual: 0` — the reverted parser returns exit code `0` (silent "success") for the review's own literal reproduction, exactly the defect being closed. **A real `--entry` file was written into this repo's own `.claude/mcp/vice/` working directory during this run** (confirmed by `git status --short` showing `?? --entry` immediately after), which is the exact hazard WR-08 describes — the test's own `finally`-block cleanup subsequently removed it during the corrected re-run.

`parseArgs()` was then restored from a pre-revert backup:

```
$ diff <backup> r2000-cli.ts && echo "BYTE-IDENTICAL after restore"
BYTE-IDENTICAL after restore
$ npx tsc --noEmit          # exit 0
$ node --test r2000-cli.test.ts
# tests 64
# pass 64
# fail 0
```

## Live Before/After Transcript

**After (fixed tree), `bootstrap x.prg --out --entry FOO`:**

```
$ node vice-proxy.ts r2000 bootstrap <tmp>/game.prg --out --entry FOO
bootstrap: --out requires a value

usage (npm install):    npx -y @henols/vice-mcp r2000 <verb>
...
exit: 1
```

Directory listing after: only `game.prg` remains — no `--entry` file, no `game.regen2000proj`.

**Before (pre-fix parser, scratch reproduction via a temporary sibling copy of `r2000-cli.ts` with the reverted `parseArgs()`, never committed):**

```
$ node ./run-prefix-scratch-driver.mjs <tmp>/game.prg
bootstrap: refusing to overwrite the existing file --entry -- pass --force to overwrite it deliberately.
exit: 1
```

(The "refusing to overwrite" message appears because an earlier `--entry` file — created by the full-suite non-vacuity run above, in the CLI's own `process.cwd()` — was still present in `.claude/mcp/vice/` at the time this scratch reproduction ran; both confirm the same underlying defect: the pre-fix parser resolves `--out`'s flag-shaped "value" as a literal, directory-less output filename and attempts to write it.)

## Issues Encountered

- `10-SECURITY.md` showed as untracked (`??`) in `git status`, not modified (` M`), when this task began — it existed on disk (created by a prior retroactive security-audit session) but had never actually been committed to the repository. This task's Task 3 commit is therefore its first appearance in git history (`git log` shows no prior commits touching this path). Not a defect in this task's scope; noted for visibility.

## User Setup Required

None.

## Next Phase Readiness

- All required verification gates pass, re-run live after all three commits:
  - `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 npm test` → **2202 tests, 2167 pass, 0 fail, 30 skipped, 5 todo** (exactly baseline 2192/2157/0/30/5 plus the 10 new WR-08 tests, all passing — no regression).
  - `npx tsc --noEmit` → exit 0.
  - `node scripts/check-npm-packages.mjs` → exit 0 (73 files `@henols/vice-mcp`, 35 files/6 skills `@henols/c64-re-tools`).
  - `node scripts/check-skill-fork-honesty.mjs` → exit 0.
  - `node scripts/check-skill-tool-coverage.mjs` → exit 0 (r2000 CLI verbs 7/7 resolved).
  - `node --test docs-linerefs.test.ts` → 3/3 pass.
  - `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts` → 8/8 pass (both ledger guards green after the todo move and STATE.md update).
  - `node --test docs-dangling-refs.test.ts` → 8/8 pass.
- `git status --porcelain` shows only this quick task's own `.planning/quick/260821-jd8-.../` directory as untracked (SUMMARY.md, not yet committed by this agent per the orchestrator's docs-commit convention).
- Phase 10's `10-SECURITY.md` is now fully closed (`threats_open: 0`), matching Phase 11's already-closed state — no open Phase 10 or Phase 11 security findings remain.

---
*Phase: quick-260821-jd8*
*Completed: 2026-08-21*

## Self-Check: PASSED

All key files confirmed present on disk (`r2000-cli.ts`, `r2000-cli.test.ts`, `10-SECURITY.md`,
`.planning/todos/completed/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md`) and
all three task commits (`3541886`, `e0fd305`, `d007d68`) confirmed present in `git log --oneline --all`.
