---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 02
subsystem: testing
tags: [d64, ci-guard, npm-packaging, skill-honesty, closure-walk, dynamic-import]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: r2000-d64.ts, r2000-cli.ts, r2000-project.ts and the review that found WR-03/05/06/07
provides:
  - "sectorSlice(): every .d64 sector read bounded against image.length, at both walk sites"
  - "petsciiName() strips $00 padding in addition to $A0, matching isEmptySlot()'s own definition"
  - "extractEntry() throws naming the sector when a final sector's usedByte < 2, instead of silently clamping to a zero-length payload"
  - "r2000-cli.ts dispatches .raw/.bin flat captures by extension, before the 65536-byte-length branch, so flatImageOrigin()'s named size refusal is always reachable"
  - "check-skill-fork-honesty.mjs's evidence:\"disasm\" exemption scoped to the \\bdisasm\\b check alone, bounded to exactly one hit via a non-vacuous exemptionHits assertion"
  - "check-npm-packages.mjs's transitive-closure walk traverses await import(\"./x.ts\") as well as static imports; r2000-cli.ts pinned by name in REQUIRED_DERIVED_MODULES"
affects: [11-03, 11-04, 11-05, 11-06, 11-07, 11-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bound check folded into the read primitive (sectorSlice) rather than left as a separate opt-in assert the caller can forget"
    - "CI guard non-vacuity proven by a planted-violation transcript, run live and reverted, never committed"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/r2000-d64.ts
    - .claude/mcp/vice/r2000-d64.test.ts
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-npm-packages.mjs

key-decisions:
  - "sectorSlice() is a new internal (non-exported) helper, not a public API change -- assertPlainImage() stays a distinct, unrelated whole-image-length check for its one existing caller"
  - "Extension-less flat captures (no .raw/.bin suffix) keep the bytes.length === 65536 branch as their only route to flatImageOrigin() -- the new extension branch is additive, not a replacement"
  - "Exemption-count non-vacuity check (exemptionHits === 1) added as a standing regression guard, not just a one-time fix, so a future second occurrence of the exemption string fails loudly"

patterns-established:
  - "A CI guard's own exemption/allowlist must be scoped to the narrowest check it protects, and its use-count pinned by a non-vacuous assertion, not just documented as scoped"

requirements-completed: [R2000-10]

# Metrics
duration: 45min
completed: 2026-08-20
---

# Phase 11 Plan 02: Close residual Phase 10 review findings (WR-03/05/06/07, folded todo 1) Summary

**Bounded `.d64` sector reads, extension-dispatched flat-capture refusal, a one-hit-scoped honesty exemption, and a dynamic-import-aware npm closure walk (48 modules, up from 43)**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-20T20:23:04Z (approx, per STATE.md's last plan-start marker)
- **Completed:** 2026-08-20T20:42:52Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- `.d64` reads can no longer silently short-read a truncated image, nor clamp a corrupt final sector to a zero-length payload with no diagnostic (WR-05).
- A `$00`-padded directory name printed by `listEntries()` is now guaranteed selectable via `extractEntry()`'s `--entry` argument (WR-06).
- A wrong-size `.raw`/`.bin` flat capture is refused by name instead of being silently reinterpreted as a `.prg` with a bogus load address (WR-07).
- `check-skill-fork-honesty.mjs`'s `disasm` exemption can no longer be combined on the same line with a live `toacme`/`cmdDisasm` reintroduction to hide it (WR-03).
- `check-npm-packages.mjs`'s transitive-closure walk now sees `await import("./x.ts")`, closing the blind spot that let the whole r2000 family (5 modules) ship correctly only by hand (folded todo 1).

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-05 + WR-06 — bound every `.d64` sector read, and decode names the way the walker defines padding** - `91d54a1` (fix)
2. **Task 2: WR-07 — dispatch flat captures by extension so the size check is reachable** - `d1beb37` (fix)
3. **Task 3: WR-03's scoped exemption and folded todo 1's dynamic-import closure walk** - `c0861a5` (fix)

## Files Created/Modified

- `.claude/mcp/vice/r2000-d64.ts` - `sectorSlice()` bounds every sector read against `image.length`; `petsciiName()` strips `$00` as well as `$A0`; final-sector `usedByte < 2` throws instead of clamping
- `.claude/mcp/vice/r2000-d64.test.ts` - fixtures: truncated image throws naming sector + actual length; `$00`-padded name round-trips through `extractEntry()`; `usedByte === 0` throws naming the sector
- `.claude/mcp/vice/r2000-cli.ts` - extension-dispatched `.raw`/`.bin` branch calling `flatImageOrigin()` before the length-based branch
- `.claude/mcp/vice/r2000-cli.test.ts` - fixtures: 4096-byte `.raw` fails naming 4096 and 65536; genuine 65536-byte `.raw` still bootstraps; 4096-byte `.prg` still bootstraps as a `.prg` (regression guard against extension-branch over-matching)
- `scripts/check-skill-fork-honesty.mjs` - `toacme`/`cmdDisasm` checks run before the exemption is consulted; `exemptionHits` counter with a `need(exemptionHits === 1, ...)` non-vacuity assertion
- `scripts/check-npm-packages.mjs` - closure walk also matches `import\s*\(\s*"(\.\/[^"]+)"\s*\)`; `["r2000-cli.ts", "R2000-09"]` added to `REQUIRED_DERIVED_MODULES`

## Decisions Made

- Kept `assertPlainImage()` unchanged and still the sole opt-in whole-image-length check for its one existing caller (`r2000-cli.ts`'s `.d64` branch), rather than folding it into `sectorSlice()` — they check different things (whole-image length vs. per-sector bounds) and the plan explicitly scoped the change this way.
- Left two literal occurrences of the string `image.subarray(off, off + 256)` in `r2000-d64.ts` (one inside `sectorSlice()`'s own return statement, required by the fix itself) rather than obfuscating the expression to satisfy the acceptance criterion's literal grep count of 0 — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan's own prescribed fixes — all three tasks matched their `<action>` text closely, including the plan's own reference implementations.

### Clarifications (not deviations, evidence-ceiling note per ENGINEERING_RULES.md §8)

**1. Acceptance criterion `grep -c 'image.subarray(off, off + 256)' r2000-d64.ts` returns 1, not 0 (Task 1)**
- **Found during:** Task 1 verification
- **Issue:** the plan's own action text prescribes `sectorSlice()`'s implementation as `return image.subarray(off, off + 256);` — the exact literal string the acceptance criterion greps for. The criterion as literally worded is unsatisfiable while implementing the plan's own recommended fix, because the bounded read still has to perform that read once it has passed the bound check.
- **Resolution:** reworded two *comments* that incidentally repeated the same literal (bringing the count down from 3 to 1), but did not obfuscate the one legitimate call site inside `sectorSlice()` itself — doing so would trade a real, readable bounded read for a cosmetic dodge of the literal grep, with no gain in the actual property being verified (zero *unguarded* reads bypassing the check). The unguarded pattern's occurrence count at the original two call sites (the directory walk and the file-chain walk) is correctly 0; `grep -c 'function sectorSlice' r2000-d64.ts` returns 1, confirming both prior direct reads route through the guarded helper.
- **Verification:** `node --test r2000-d64.test.ts` (14/14 pass, including the new truncated-image fixture), `npm run typecheck` clean.

---

**Total deviations:** 0 auto-fixed; 1 clarification recorded against an internally-inconsistent acceptance criterion.
**Impact on plan:** None on scope or behavior — the underlying property (bound check is part of every sector read, no bypass) is verified true; only one acceptance criterion's literal wording could not be satisfied without weakening the fix itself.

## Non-Vacuous Verification Transcripts (ENGINEERING_RULES.md §6, Task 3)

Both CI guards were observed failing under a planted violation before being trusted. Neither planted state was committed — each was reverted immediately after capturing the transcript, confirmed by a clean `git diff --stat` on the affected file.

### (a) `check-skill-fork-honesty.mjs` — combined `cmdDisasm` + `evidence: "disasm"` line

Planted a line appended to `.claude/skills/c64-provenance-diff/scripts/diff-images.test.mjs`:
```
// see acme.mjs cmdDisasm / toacme, evidence: "disasm"
```

`node scripts/check-skill-fork-honesty.mjs` output:
```
check-skill-fork-honesty: FAIL
  - .claude/skills/c64-provenance-diff/scripts/diff-images.test.mjs:666: "toacme" reappeared -- plan 10-06 deleted this tool dependency in full; a playbook or reference page naming it again sends an agent looking for a binary this project no longer wraps.
  - .claude/skills/c64-provenance-diff/scripts/diff-images.test.mjs:666: "cmdDisasm" reappeared -- this function was deleted from acme.mjs in plan 10-06; a reference to it again advertises a verb the script no longer has.
  - WR-03 non-vacuity: expected the "evidence: "disasm"" exemption to fire exactly once (the one documented diff-images.test.mjs provenance-ledger string), got 2 -- a second occurrence means the exemption is being used to hide a reintroduction rather than covering the one pinned, harmless string.
```
Exit code 1. Reverted; `node scripts/check-skill-fork-honesty.mjs` afterward: `OK -- 11 fork-only mentions across 30 files in 6 skill directories, ...`.

### (b) `check-npm-packages.mjs` — `r2000-cli.ts` removed from `files[]`

Removed the `"r2000-cli.ts",` line from `.claude/mcp/vice/package.json`'s `files[]`.

`node scripts/check-npm-packages.mjs` output:
```
check-npm-packages: FAIL
  - vice-mcp: missing r2000-cli.ts -- R2000-09 would ship a package that throws ERR_MODULE_NOT_FOUND
  - vice-mcp: r2000-cli.ts is imported by vice-proxy.ts but is not in the published tarball -- Rule 2 (see 6801cf5, 897faf6)
```
Exit code 1 — caught independently by both the named `REQUIRED_DERIVED_MODULES` check and the dynamic-import-aware closure walk. Reverted; `node scripts/check-npm-packages.mjs` afterward: `check-npm-packages: transitive closure from vice-proxy.ts -- 48 modules, clean` / `check-npm-packages: OK`.

### Closure-count evidence (acceptance criterion)

- Before this plan's Task 3 fix: `check-npm-packages: transitive closure from vice-proxy.ts -- 43 modules, clean`
- After: `check-npm-packages: transitive closure from vice-proxy.ts -- 48 modules, clean` (the r2000 family — `r2000-cli.ts`, `r2000-d64.ts`, `r2000-project.ts`, `r2000-launch.ts`, `r2000-verify.ts` — is now traversed via the dynamic-import match)

## Issues Encountered

- The plan's suggested Task 1 test fixture for the truncated-image case would have needed the entry's data chain to sit at a track *before* the directory track (18) to reproduce the exact scenario; placing it at track 5 (as `twoEntryImage()` does elsewhere in the file) meant truncating far enough to expose the entry's own sector also truncated the directory sector itself, so `listEntries()` (called internally by `extractEntry()`) threw on the directory read before ever reaching the entry's own chain — a different, though still-correct, throw path than the one being tested. Fixed by building a dedicated fixture in the new test placing the entry's chain at tracks 30/31 (after the directory), so the directory read succeeds and only the entry's own second sector is short-read. This is a test-construction detail, not a deviation from the plan's intended fix.
- `npm run test:automated` in `.claude/mcp/vice` reported 1 pre-existing, out-of-scope failure unrelated to any file this plan touched: `repo-root.test.ts`'s "path agreement ... is not under .claude" assertion fails specifically because this executor runs inside a git worktree physically located at `.../.claude/worktrees/agent-.../`, so the resolved repo root is (correctly, for this environment) under a path containing the literal string `.claude`. This is an artifact of the worktree-isolation mechanism itself, not a defect in `repo-root.ts` or any file this plan modified, and is out of this plan's scope (SCOPE BOUNDARY rule). Logged here rather than fixed; not present in `deferred-items.md` since it is a worktree-execution artifact rather than a codebase defect requiring future disposition.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four residual Phase 10 review findings this plan owned (WR-03, WR-05, WR-06, WR-07) are fixed and pinned by a fixture or assertion that fails without the fix.
- Folded todo 1 (dynamic-import blindness in the npm closure walk) is closed in code; per the plan, the todo file's own disposition (moving `.planning/todos/pending/2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md`) is handled by plan 11-03, not this plan.
- `r2000-d64.ts` and `r2000-cli.ts` are now hardened ahead of plans 11-06/11-07/11-08, each of which adds a verb to `r2000-cli.ts` per this plan's own objective.
- No blockers for 11-03 onward.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*
