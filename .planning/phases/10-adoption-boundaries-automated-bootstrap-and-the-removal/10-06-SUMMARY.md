---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 06
subsystem: skills
tags: [acme-build, c64-program-recon, r2000, deletion, toacme, regenerator2000, d-12]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "r2000-cli.ts's export-asm/verify verbs (10-04), r2000-verify.ts and the live reassembly evidence transcript (10-05) -- the proven replacement route this plan earns the right to delete toacme against"
provides:
  - "acme-build's three-verb acme.mjs (new/build/sym), wrapping acme alone, no toacme dependency anywhere in the tool surface"
  - "One documented replacement route (vice-mcp r2000 export-asm/verify), pointed at from both acme-build/SKILL.md and c64-program-recon/SKILL.md, neither carrying a duplicate copy of the other's wording (D-12)"
  - "A widened whole-tree completeness gate (--include='*.md' --include='*.mjs' across .claude/skills), proven live to catch a reintroduced reference in a references/ page a narrower --include=SKILL.md gate could not see"
affects: ["10-07", "10-08 (owns the permanent CI regression assertion for this deletion)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deletion verified with an intentionally-wide grep gate (--include='*.md' --include='*.mjs', not --include=SKILL.md), and the gate itself proven non-vacuous by a blind-spot mutation check: temporarily reintroduce the deleted string in a references/ page, confirm the gate fails naming that exact file, then revert"

key-files:
  created: []
  modified:
    - .claude/skills/acme-build/scripts/acme.mjs
    - .claude/skills/acme-build/SKILL.md
    - .claude/skills/c64-program-recon/SKILL.md
    - .claude/skills/c64-program-recon/references/tool-selection.md
    - .claude/skills/c64-ram-capture/SKILL.md
    - .claude/skills/c64-provenance-diff/SKILL.md

key-decisions:
  - "Kept the `## Disassembly` heading in acme-build/SKILL.md rather than removing it -- replaced its body with a short pointer (route, why the old caveats no longer apply, and the r2000 verify evidence path) rather than deleting the section entirely, so a reader following the file's existing structure still lands somewhere relevant"
  - "Placed c64-program-recon's new pointer section (## Static disassembly) before ## Before you touch the emulator, distinguishing the static r2000 route from the live-RAM vice_disassemble route already in the tool-selection.md table, per D-12's 'one implementation, referenced from wherever needed' rule"
  - "Folded tool-selection.md's two competing rows (the stale toacme 'fast first-pass listing' row and the regenerator2000 'still MEDIUM' row) into one row naming the proven route and citing the live verify evidence, rather than editing the two rows separately -- the plan's own instruction, to avoid ending up with two disassembly options where one names a deleted verb"
  - "Reworded one explanatory sentence in acme-build/SKILL.md's replacement pointer ('a flat linear decoder' instead of naming toacme) to avoid tripping the file's own zero-toacme-references acceptance criterion -- the same grep-gate hygiene issue plans 10-01/10-04/10-05 each documented for their own literal-substring collisions"

requirements-completed: [R2000-05]

# Metrics
duration: ~20min
completed: 2026-08-20
---

# Phase 10 Plan 06: Delete cmdDisasm, point both skills at the proven r2000 route Summary

**The 14-line `toacme` wrapper (`cmdDisasm`), its dispatch entry, its usage line, and ~50 lines of SKILL.md caveats structural to a flat linear decoder are gone; `acme-build` and `c64-program-recon` now both point at the single, live-verified `vice-mcp r2000 export-asm`/`verify` route, and a widened whole-tree grep gate — proven to bite on a non-`SKILL.md` file — confirms zero `disasm`/`toacme` references survive anywhere under `.claude/skills/`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-20T16:29:41Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Deleted `cmdDisasm()` from `acme.mjs` in full (the function, its `toacme` header comment, its `VERBS` dispatch entry, and its usage line). The script's three surviving verbs (`new`, `build`, `sym`) still run correctly; `readFileSync` stayed imported since `cmdNew` and `build()` still use it. Verified live: bare `node acme.mjs` prints a three-verb usage and exits 0; `node acme.mjs disasm foo.prg` now exits 1 as an unknown verb; `node acme.mjs new <tmp>.a` still exits 0.
- Stripped `acme-build/SKILL.md` of every sentence that existed only because of `toacme`'s flat linear decode: the frontmatter description's dangling verb clause, the `disasm` synopsis line, the entire ~50-line `## Disassembly` caveat section (out-of-range labels, illegal-opcode re-indentation, the `.dis.a`→`.dis.asm` Read-tool workaround), the `toacme` half of the Setup paragraph, and the stale "and a first-pass dead listing back" clause in the cross-skill table.
- Replaced the vacated `## Disassembly` section with a short pointer: names regenerator2000 as a **required prerequisite**, quotes both invocation forms verbatim from `10-04-SUMMARY.md` (`npx -y @henols/vice-mcp r2000 export-asm game.prg` and the in-repo `vice-proxy.ts r2000 export-asm` form), states in one sentence why the caveats are gone (a recursive-descent disassembler with an auto-analyzer doesn't render strings/tables/the BASIC stub as instructions), and points at `vice-mcp r2000 verify` plus the committed live evidence transcript from plan 10-05 — without restating the route's mechanics (D-12).
- Added a `## Static disassembly` section to `c64-program-recon/SKILL.md` — the skill's first mention of the route at all — distinguishing it from the live-RAM `vice_disassemble` route already named in `references/tool-selection.md` (static, over a file on disk, vs. reading a running emulator's RAM at a checkpoint), and stating the D-02 `.d64` rule (name the entry file explicitly; the tool lists the directory and refuses rather than guess).
- Corrected all **four** stale cross-skill rows, not just the two PATTERNS.md's blast-radius table enumerated: the three "Assembling, or a first-pass dead listing | `acme-build`" rows in `c64-program-recon/SKILL.md`, `c64-ram-capture/SKILL.md` and `c64-provenance-diff/SKILL.md` (now "Assembling | `acme-build`", plus a new dedicated disassembly row in the recon file), and the `references/tool-selection.md` row that survived every earlier `--include=SKILL.md` pass because it is a `.md` file not literally named `SKILL.md` — folded its stale `toacme`/"still MEDIUM" rows into one row naming the proven route and citing the live `--verify` evidence.
- Ran the widened whole-tree gate (`grep -rniE 'disasm|toacme' .claude/skills --include='*.md' --include='*.mjs'`, excluding `c64-provenance-diff`'s `evidence: "disasm"` provenance-ledger string) — zero lines. Then proved the gate itself is not vacuous: temporarily appended a `toacme` marker line to `tool-selection.md`, re-ran the gate, confirmed it failed naming exactly that file and line, and reverted the file to its clean, intentional state (confirmed via `git diff` showing only the intended one-row fold, no stray marker).

## Task Commits

Each task was committed atomically:

1. **Task 1: delete cmdDisasm and its two other sites from acme.mjs** - `f519f53` (feat)
2. **Task 2: strip the Disassembly caveats and the toacme prerequisite from acme-build/SKILL.md, and point at the replacement** - `e224ac7` (docs)
3. **Task 3: point c64-program-recon at the same route, and fix all four stale cross-skill rows** - `4c30f01` (docs)

**Plan metadata:** committed as part of this SUMMARY (STATE.md/ROADMAP.md are NOT touched by this worktree agent, per orchestrator instructions).

## Files Created/Modified

- `.claude/skills/acme-build/scripts/acme.mjs` - `cmdDisasm()` deleted in full, `VERBS` table down to `{ new, build, sym }`, usage block's `disasm` line removed
- `.claude/skills/acme-build/SKILL.md` - frontmatter description, synopsis, scope sentence, `## Disassembly` section, Setup paragraph and cross-skill table all corrected; short r2000 pointer added in the vacated section
- `.claude/skills/c64-program-recon/SKILL.md` - new `## Static disassembly` section; cross-skill table row split into "Assembling" + a new disassembly row
- `.claude/skills/c64-program-recon/references/tool-selection.md` - the stale `toacme`/"still MEDIUM" rows folded into one row naming the proven route
- `.claude/skills/c64-ram-capture/SKILL.md` - cross-skill table row corrected
- `.claude/skills/c64-provenance-diff/SKILL.md` - cross-skill table row corrected

## Decisions Made

- Kept the `## Disassembly` heading in `acme-build/SKILL.md` as a pointer landing spot rather than removing the heading entirely.
- Placed the new `c64-program-recon` pointer section before `## Before you touch the emulator`, ahead of the existing cross-skill table.
- Folded the two competing `tool-selection.md` rows into one, per the plan's explicit instruction, rather than editing them independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1-adjacent — grep-gate hygiene] Reworded one explanatory sentence in `acme-build/SKILL.md`'s replacement pointer to avoid a literal `toacme` substring collision**
- **Found during:** Task 2, immediately after writing the replacement pointer and running the file's own acceptance-criteria grep.
- **Issue:** The pointer's explanatory sentence ("the caveats this section used to carry were structural to `toacme`'s flat linear decode") used the literal word `toacme` to explain why the caveats no longer apply — but the task's own acceptance criterion requires `grep -ciE 'disasm|toacme|dis\.a|dis\.asm'` on this file to return 0. Same class of issue plans 10-01/10-04/10-05 each documented for their own literal-substring collisions with their own acceptance-criteria greps.
- **Fix:** Reworded to "structural to a flat linear decoder" — same meaning, no literal substring collision.
- **Files modified:** `.claude/skills/acme-build/SKILL.md` (part of Task 2, before its commit)
- **Verification:** `grep -ciE 'disasm|toacme|dis\.a|dis\.asm' .claude/skills/acme-build/SKILL.md` returns 0; all other Task 2 acceptance-criteria greps return their expected counts.
- **Committed in:** `e224ac7` (Task 2 commit — corrected before the file's one commit, not as a separate fix-up).

---

**Total deviations:** 1 auto-fixed (grep-gate hygiene, self-contained within Task 2's single commit — no separate fix-up commit needed).
**Impact on plan:** Required to make the plan's own specified acceptance criteria pass at all; no scope creep, no behavior beyond what the plan specified.

## Issues Encountered

- None beyond the grep-gate hygiene deviation above. `npm ci` had not yet been run in this worktree (fresh checkout); ran it once before running the test suite — 237 packages installed, no changes to `package.json`/`package-lock.json`.
- Full `npm test` (1925 tests, ~84s) surfaced exactly one failure unrelated to this plan's files: `repo-root.test.ts`'s "path agreement" test — the same pre-existing worktree-path artifact documented in plans 10-01 through 10-05's own summaries. This worktree's checkout path sits under `.claude/worktrees/agent-.../`, which that test's own "must not be under `.claude`" assertion structurally cannot pass from inside any GSD worktree. Neither this plan's task touches `repo-root.ts` or any file it depends on.

## Verification

1. The widened whole-tree gate returns zero lines: `grep -rniE 'disasm|toacme' .claude/skills --include='*.md' --include='*.mjs' | grep -v 'evidence: "disasm"'` — empty. Confirmed non-vacuous by the mandatory blind-spot mutation check (see Accomplishments).
2. `git diff --name-only 28a781c HEAD` shows exactly the plan's six declared `files_modified` — no file under `.claude/mcp/vice/` was touched, in particular none of `disasm-roundtrip.test.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`, `stock-disassemble.ts`.
3. `node scripts/check-skill-tool-coverage.mjs` and `node scripts/check-skill-fork-honesty.mjs` both exit 0.
4. `cd .claude/mcp/vice && npm test` — 1889 pass / 1 fail (known pre-existing worktree artifact, see above) / 30 skip / 5 todo, no hang, 1925 total.
5. `cd .claude/mcp/vice && npx tsc --noEmit` exits 0.
6. `node scripts/check-npm-packages.mjs` — OK, both tarballs pass (`@henols/vice-mcp` 64 files, `@henols/c64-re-tools` 35 files + 6 skills).
7. `git status --short` after the full run shows no stray untracked files (`installer/skills/` regenerated by the `prepack` sync and gitignored, as expected).

## User Setup Required

None. `acme` (0.97 "Zem") was already installed on this host; `toacme` is no longer a dependency of anything in this repository.

## Next Phase Readiness

- The deletion this milestone earned (criterion 4, R2000-05) is complete: `acme-build` wraps `acme` alone, both consuming skills point at the same proven route, and all four stale cross-skill rows (three `SKILL.md` rows plus the `references/tool-selection.md` row a narrow gate could not see) are corrected.
- Plan 10-08 still owns the permanent CI regression assertion (`scripts/check-skill-fork-honesty.mjs`-style guard) for this deletion — nothing in this plan duplicates that file.
- No blockers.

## Threat Flags

None. This plan only deletes stale documentation/tooling references and adds pointer prose to an already-existing, already-guarded route (`vice-mcp r2000 …`); it introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary beyond what plans 10-04/10-05 already covered in their own threat models.

---
*Phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal*
*Plan: 06*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-06-SUMMARY.md`
- FOUND commit `f519f53` (feat: delete cmdDisasm)
- FOUND commit `e224ac7` (docs: strip acme-build SKILL.md caveats)
- FOUND commit `4c30f01` (docs: point c64-program-recon at r2000 route, fix stale rows)
