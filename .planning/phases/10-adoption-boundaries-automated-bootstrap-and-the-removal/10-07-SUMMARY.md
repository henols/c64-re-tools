---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 07
subsystem: skills-ci
tags: [acme-build, ci, template.a, r2000-05, folded-todo-2]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "acme-build/SKILL.md as plan 10-06 left it (toacme deletion, r2000 pointer already in place) -- this plan edits the same file on top of that state"
provides:
  - "template.a that assembles against a bare ACME install with no cbm/c64 standard library on either documented provisioning route"
  - "A CI step that actually assembles the shipped scaffold and asserts its $0801 load address, replacing a banner-grep-only proof"
  - "acme-build/SKILL.md Setup section stating the measured, re-checkable truth instead of a one-machine 2026-08-04 observation"
affects: ["10-08 (concurrent; owns the permanent toacme/cmdDisasm regression guard, does not touch this plan's three files)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ACME's !address pseudo-op used to type hardware-register constants correctly, avoiding spurious -Wtype-mismatch warnings that a plain `=` numeric assignment produces when the symbol is later used as a memory operand (sta/jsr)"

key-files:
  created: []
  modified:
    - .claude/skills/acme-build/template.a
    - .claude/skills/acme-build/SKILL.md
    - .github/workflows/ci.yml

key-decisions:
  - "Defined five local hardware constants inline in template.a (vic_cborder, vic_cbg, viccolor_BLACK, viccolor_GREEN, k_chrout) rather than vendoring a cbm/c64 library alongside the scaffold, per the plan's explicit choice -- avoids adding third-party assembly source (and its licence/THIRD-PARTY-NOTICES consequences) to two published packages to save four !source lines"
  - "Used ACME's !address pseudo-op (not plain `=`) for the four register/KERNAL constants after discovering plain assignment produced three 'Wrong type - expected address' warnings under -Wtype-mismatch on every sta/jsr use -- !address types the symbol correctly and the build is warning-free"
  - "Named the new CI step 'Assemble the acme-build scaffold (library-free)' and cited that exact name from SKILL.md's Setup section, so the doc's claim is mechanically re-checkable against the workflow file rather than a confidence assertion"
  - "Fixed one line in SKILL.md's References table ('the three !source libraries') that Task 1's rewrite made factually wrong about template.a's contents -- in scope because it is the same file this plan already edits and was now directly contradicted by this plan's own Task 1 change (Rule 1)"
  - "Reworded the WHY-comment in template.a to avoid the literal substring 'cbm/c64' (used generic phrasing like 'the standard hardware-register library' instead), after the first draft's grep-gate self-check caught it colliding with the task's own acceptance criterion -- same class of literal-substring collision plans 10-01/10-04/10-05/10-06 each documented"

requirements-completed: [R2000-05]

# Metrics
duration: ~35min
completed: 2026-08-20
---

# Phase 10 Plan 07: Close the acme-build scaffold library gap Summary

**`template.a` now assembles with nothing but the `acme` binary on PATH (no `cbm/c64/*.a` library on either documented provisioning route), CI proves it by actually assembling the scaffold and checking its `$0801` load address instead of grepping a version banner, and `acme-build/SKILL.md`'s Setup section states the measured, re-checkable truth instead of a one-machine 2026-08-04 observation.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-20 (resumed once after a mid-execution interruption; worktree and all 3 commits survived intact -- see Issues Encountered)
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- Rewrote `.claude/skills/acme-build/template.a`: replaced the three `!source <cbm/c64/...>` includes with five locally-defined constants (`vic_cborder = $d020`, `vic_cbg = $d021`, `viccolor_BLACK = 0`, `viccolor_GREEN = 5`, `k_chrout = $ffd2`) covering exactly the symbols the scaffold body uses. Added a WHY comment block citing Phase 8.1 FINDING-A1 and pointing at `$ACME` for users who want the full library in their own sources.
- **Live-verified first-hand on this host** (not assumed from the inherited context) that neither `~/.local/bin/acme` (0.97 "Zem") nor any of the four probe locations `findAcmeLib()` checks (`/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`) contains `cbm/c64/vic.a` -- all four `ls` checks returned "No such file or directory". This confirms the plan's premise rather than merely trusting the inherited-context claim.
- Assembled the scaffold twice with `ACME` explicitly cleared (`new` then `build`), confirming a `55`-byte `.prg` with load address `$0801`-`$0836` (53 bytes of code), first two bytes `01 08`. First draft (plain `=` constant assignment) produced three `Wrong type - expected address` warnings from `-Wtype-mismatch` on the `sta`/`jsr` operand lines -- fixed by switching the four register/KERNAL constants to ACME's `!address` pseudo-op, after which the build is clean with zero warnings and the symbol table correctly shows all 4 as address-typed (`4 used / 4 total`, `4 addresses` in the `.vs` debug labels).
- Rewrote `acme-build/SKILL.md`'s `## Setup` section: states `acme` on `$PATH` is the only requirement, the scaffold is deliberately library-free (citing Phase 8.1 FINDING-A1), the `$ACME` probe still matters only for a user's own angle-bracket includes (not the scaffold), and cites the new CI step by name (`"Assemble the acme-build scaffold (library-free)"`) instead of repeating the dated "Verified live in this container on 2026-08-04" one-machine claim. Also corrected the now-stale References-table description of `template.a` ("the three `!source` libraries" -> "five local hardware constants (no library needed)"), a Rule-1 fix made necessary by this plan's own Task 1 change to the same file.
- Added a new CI step, `Assemble the acme-build scaffold (library-free)`, immediately after the "Install ACME cross-assembler" step and before `Test`: scaffolds via `new` to `${RUNNER_TEMP}/acme-build-scaffold-check.a`, assembles via `build`, both invoked as `node .claude/skills/acme-build/scripts/acme.mjs ...` from the repo root with `ACME=` cleared in the step's own environment, then asserts the `.prg` is non-empty and its first two bytes are `01 08`. A comment above the step states why the prior banner grep alone was insufficient (it only proved a binary named `acme` exists, never that the shipped scaffold could assemble) and cites the closing todo. Confirmed `grep -c 'VICE_REQUIRE_R2000'` and `grep -c 'regenerator2000'` on `ci.yml` both still return `0` after the edit (D-11 intact) -- re-verified again after the mid-execution interruption, since a merged test from plan 10-05 asserts the `VICE_REQUIRE_R2000` count.

## Task Commits

Each task was committed atomically:

1. **Task 1: rewrite template.a with local hardware constants, proven to assemble with no ACME library present** - `568c4ba` (feat)
2. **Task 2: correct acme-build/SKILL.md's Setup claim to the measured truth** - `78aebcf` (docs)
3. **Task 3: make CI assemble the scaffold instead of probing the binary** - `8a2c357` (feat)

**Plan metadata:** committed as part of this SUMMARY (STATE.md/ROADMAP.md are NOT touched by this worktree agent, per orchestrator instructions -- the orchestrator owns those writes after all wave agents complete).

## Files Created/Modified

- `.claude/skills/acme-build/template.a` - three `!source <cbm/c64/...>` includes replaced with five local `!address`/plain constants; new WHY comment block; everything else (BASIC stub, SYS-digit computation, `entry` label, print loop, PETSCII message) kept byte-for-byte
- `.claude/skills/acme-build/SKILL.md` - `## Setup` section rewritten to the measured truth (library-free by design, `$ACME` still matters for user sources only, CI step cited by name); one stale References-table line corrected
- `.github/workflows/ci.yml` - new `Assemble the acme-build scaffold (library-free)` step added between the ACME install step and `Test`

## Decisions Made

- Local inline constants over vendoring a library (avoids third-party assembly source in two published packages; see key-decisions above for the full rationale).
- `!address` pseudo-op over plain `=` for the four register/KERNAL constants, discovered necessary via the live build's own warnings, not anticipated in the plan text.
- Cited the new CI step's exact name from SKILL.md so the claim stays mechanically re-checkable.
- Fixed one incidental stale line in SKILL.md's References table that Task 1 made factually wrong, in scope because it is the same file already being edited.
- Reworded one WHY-comment sentence in `template.a` to avoid a literal `cbm/c64` substring collision with the task's own acceptance criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched four constants from plain `=` to ACME's `!address` pseudo-op after live build produced spurious `-Wtype-mismatch` warnings**
- **Found during:** Task 1, immediately after the first successful (warnings-but-exit-0) live build.
- **Issue:** `vic_cborder`, `vic_cbg`, and `k_chrout` defined via plain `label = value` assignment are typed as ACME "Number", not "Address". `-Wtype-mismatch` (already in `acme.mjs`'s fixed arg list, intended to catch a missing `#` on an immediate) fired three false-positive "Wrong type - expected address" warnings on the `sta`/`jsr` lines that reference them as memory operands.
- **Fix:** Prefixed the four register/KERNAL constant definitions with ACME's `!address` pseudo-op (`!address vic_cborder = $d020`, etc.), which types them correctly. Left `viccolor_BLACK`/`viccolor_GREEN` as plain numeric constants since they are genuinely used as immediates (`lda #viccolor_BLACK`).
- **Files modified:** `.claude/skills/acme-build/template.a`
- **Verification:** Re-ran the library-free `new`+`build` cycle; zero warnings, same `55`-byte `$0801`-`$0836` output, symbol table now shows all four as address-typed (`4 used / 4 total`).
- **Commit:** `568c4ba` (folded into Task 1's single commit, not a separate fix-up).

**2. [Rule 1-adjacent - grep-gate hygiene] Reworded `template.a`'s WHY-comment to avoid a literal `cbm/c64` substring collision with its own acceptance criterion**
- **Found during:** Task 1, running the task's own acceptance-criteria grep (`grep -c 'cbm/c64' .claude/skills/acme-build/template.a` must return 0) against the first draft.
- **Issue:** The explanatory WHY-comment's second half referenced `cbm/c64/vic.a` by name when telling users how to restore library includes via `$ACME` -- but the task's own acceptance criterion forbids any `cbm/c64` literal surviving in the file at all. Same class of literal-substring collision plans 10-01/10-04/10-05/10-06 each documented for their own acceptance-criteria greps.
- **Fix:** Reworded to "the standard hardware-register library" / "that library (with vic.a inside it)" -- same meaning, no literal `cbm/c64` substring.
- **Files modified:** `.claude/skills/acme-build/template.a` (part of Task 1, before its commit)
- **Verification:** `grep -c 'cbm/c64' .claude/skills/acme-build/template.a` returns 0; all other Task 1 acceptance-criteria greps return their expected counts.
- **Committed in:** `568c4ba` (Task 1 commit).

**3. [Rule 1 - Bug] Corrected a References-table line in SKILL.md that Task 1's own rewrite made factually wrong**
- **Found during:** Task 2, while reviewing the full file for other stale mentions of the library before touching the Setup section.
- **Issue:** `## References`'s `template.a` row still said "the three `!source` libraries", which was true before Task 1 and false after it.
- **Fix:** Changed to "five local hardware constants (no library needed)".
- **Files modified:** `.claude/skills/acme-build/SKILL.md` (part of Task 2, before its commit)
- **Verification:** Manual re-read of the References table; no automated grep specified this in the plan, but the fix is directly load-bearing for the file's own internal consistency.
- **Committed in:** `78aebcf` (Task 2 commit).

---

**Total deviations:** 3 auto-fixed (one build-behavior bug caught by the live verification the plan itself mandated, two grep-gate/consistency hygiene fixes), all folded into their respective task's single commit -- no separate fix-up commits needed.
**Impact on plan:** Required to make the plan's own specified acceptance criteria and the live-build verification actually pass; no scope creep beyond the plan's three declared files.

## Issues Encountered

- **Mid-execution interruption, no data loss.** The Claude Code process running this agent exited partway through the post-Task-3 verification pass (after all 3 task commits had already landed). On resume, the orchestrator confirmed the worktree branch (`worktree-agent-abd28a7e9be0624af`), all 3 commits (`568c4ba`, `78aebcf`, `8a2c357`), and a clean working tree survived intact. Re-ran every verification step from scratch after resuming (live library-free assembly, `VICE_REQUIRE_R2000` grep, both skill guards, the whole-tree `disasm`/`toacme` gate) rather than trusting pre-interruption memory -- all passed identically to the pre-interruption run.
- `.claude/mcp/vice/node_modules/` was not present in this worktree at verification time (fresh checkout, `npm ci` not yet run). None of this plan's three tasks touch `.claude/mcp/vice/`, and none of the plan's specified acceptance-criteria or verification commands require the MCP server's test suite -- all of them are `acme.mjs`/`ci.yml`/`SKILL.md` shell-level checks that ran directly with `node` and standalone scripts (`check-skill-fork-honesty.mjs`, `check-skill-tool-coverage.mjs`, `check-npm-packages.mjs`), none of which import from `.claude/mcp/vice/node_modules/`. Did not run `npm ci` or the MCP `node --test` suite as part of this plan, since it is out of scope for the declared `files_modified` and the plan's own `<verification>` section does not call for it.
- **Note for the verifier / next agent:** none of `acme-build`'s scripts have a co-located `*.test.mjs` file (confirmed: `ls .claude/skills/acme-build/scripts/` shows only `acme.mjs`), so there is no skill-side unit test this plan's CI step duplicates or could conflict with. The new CI step's proof is entirely the live `new`+`build`+load-address assertion added directly in `ci.yml`, run as its own step rather than by `npm test` -- worth keeping in mind if a future plan adds `.test.mjs` coverage for `acme-build/scripts/`, since CI's `npm test` step (`working-directory: .claude/mcp/vice`) does not reach files under `.claude/skills/`.
- No blockers.

## Verification

1. Live library-free assembly, re-run twice (once pre-interruption, once post-resume), both times with `ACME=` cleared:
   ```
   $ rm -f /tmp/scaffold-check.*
   $ ACME= node .claude/skills/acme-build/scripts/acme.mjs new /tmp/scaffold-check.a
   wrote /tmp/scaffold-check.a
   next: node .claude/skills/acme-build/scripts/acme.mjs build /tmp/scaffold-check.a
   $ ACME= node .claude/skills/acme-build/scripts/acme.mjs build /tmp/scaffold-check.a
     Saving 53 (0x35) bytes (0x801 - 0x836 exclusive).
   built /tmp/scaffold-check.prg (55 bytes)  load $0801-$0836  53 bytes of code
   symbols: /tmp/scaffold-check.sym (4 used / 4 total)
   debug labels: /tmp/scaffold-check.vs (4 addresses)
   $ head -c 2 /tmp/scaffold-check.prg | od -An -tx1
    01 08
   $ stat -c %s /tmp/scaffold-check.prg
   55
   ```
2. Confirmed first-hand on this host (not merely inherited) that no probe location contains the library: `ls /usr/local/share/acme/cbm/c64/vic.a`, `/usr/share/acme/...`, `/usr/lib/acme/...`, `~/.acme/...` all returned "No such file or directory"; `~/.local/bin/acme --version` reports "ACME, release 0.97 (\"Zem\"), 31 Jan 2021".
3. `grep -c 'cbm/c64' .claude/skills/acme-build/template.a` -> `0`; `grep -c '!cpu 6510'` -> `1`; `grep -c 'k_chrout'` -> `2`.
4. `grep -ciE 'disasm|toacme' .claude/skills/acme-build/SKILL.md` -> `0`; the widened whole-tree gate (`grep -rniE 'disasm|toacme' .claude/skills --include='*.md' --include='*.mjs' | grep -v 'evidence: "disasm"'`) -> empty, re-confirmed post-resume.
5. `grep -ci 'Verified live in this container on 2026-08-04'` -> `0`; all five `findAcmeLib()` probe strings (`$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`) present in the Setup section; `grep -ci 'no .*librar'` -> `2`.
6. `grep -c 'acme-build/scripts/acme.mjs' .github/workflows/ci.yml` -> `2`; `grep -c 'VICE_REQUIRE_R2000'` -> `0` (re-checked post-resume per the orchestrator's explicit ask); `grep -c 'regenerator2000'` -> `0`. New step (`line 83`) confirmed before `Test` (`line 110`) by file order.
7. The exact CI step shell logic, executed locally from the repo root with `RUNNER_TEMP=/tmp` and `ACME=` cleared, exits 0 and prints `scaffold assembled: /tmp/acme-build-scaffold-check.prg loads at $0801`.
8. YAML parses two ways: `node -e "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')"` (read OK) and `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` (parse OK, PyYAML).
9. `node scripts/check-skill-fork-honesty.mjs` and `node scripts/check-skill-tool-coverage.mjs` both exit 0, re-confirmed post-resume.
10. `node scripts/check-npm-packages.mjs` exits 0 -- both tarballs pass (`@henols/vice-mcp` 64 files, `@henols/c64-re-tools` 35 files + 6 skills, `template.a` still shipped).
11. `git diff --stat 6dffa1a HEAD` touches exactly the plan's three declared files (`template.a`, `SKILL.md`, `ci.yml`) -- no scope creep, no files belonging to concurrent plan 10-08.

## User Setup Required

None. `acme` (0.97 "Zem") is already installed at `~/.local/bin/acme` on this host and requires no library directory for the shipped scaffold to assemble.

## Next Phase Readiness

- Folded todo 2 (the library gap on both provisioning routes) is closed: the scaffold assembles anywhere `acme` is installed, and CI now proves it with a real build rather than a version banner.
- Criterion 4's `r2000 verify` proof now rests on an ACME installation demonstrably capable of assembling this project's own scaffold, closing the foundational gap the plan's objective named.
- Plan 10-08 is running concurrently and is unaffected: it owns `README.md`, `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`, and `scripts/check-skill-fork-honesty.mjs`, none of which this plan touched. This plan's `disasm`/`toacme`-gate re-checks all passed, so 10-08's permanent regression guard should merge cleanly against this plan's `SKILL.md` state.
- No blockers.

## Threat Flags

None. This plan replaces library includes with inline constants (removing a third-party-source surface, not adding one -- see key-decisions), adds a CI step that runs the same locally-fixed-argv `acme.mjs` invocation the wrapper already performs (no new subprocess-invocation pattern), and edits documentation prose. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary is introduced.

---
*Phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal*
*Plan: 07*
*Completed: 2026-08-20*
