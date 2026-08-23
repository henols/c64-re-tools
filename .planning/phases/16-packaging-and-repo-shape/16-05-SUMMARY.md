---
phase: 16-packaging-and-repo-shape
plan: 05
subsystem: packaging
tags: [documentation-sweep, claude-md, readme, line-reference-guard, repo-layout]

requires:
  - phase: 16-packaging-and-repo-shape
    provides: "plan 16-04's src/mcp/vice/ relocation and plan 16-01's src/skills/ relocation (the target paths this sweep repoints to), plus 16-04's closed tree-wide enumeration classifying every remaining old-path hit as plan-16-05-owned, deliberately-preserved consumer/detection literal, or deliberately-preserved historical narration"
provides:
  - "CLAUDE.md, README.md and four docs/*.md files repointed to the relocated src/mcp/vice/ and src/skills/ trees -- the phase's single documentation sweep, run once after every source-editing plan landed"
  - "The architectural derived-tool interception citations (vice-proxy.ts:3046/2981/1525/1501) re-measured against final source and confirmed unchanged"
  - "The Project Skills table's acme-build description corrected to match src/skills/acme-build/SKILL.md's own frontmatter (a pre-existing drift from Phase 10's disasm/toacme removal, found during this sweep)"
  - "README.md's stale 'internal layout mirrors a project tree' claim, which contradicted plan 16-01's already-added no-in-repo-autoload section, consolidated into one accurate statement"
affects: []

actuals:
  tokens: 9650
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Path-only sweep via a line-scoped node script rather than a blanket sed: preserves any line containing a named consumer-install literal (<target>/.claude/skills/, <project>/.claude/skills/) verbatim while repointing every other occurrence on the same file, avoiding the two-pass sed-then-revert dance a blanket substitution would need."
    - "Evidence documents get a narrower edit than design prose: only the literal path text inside a live pointer (naming the CURRENT authoritative file/fixture) is repointed; a captured command-line transcript recording what was literally typed on a specific past date is left untouched even though it names the pre-move path, because rewriting it would misrepresent the historical record."
    - "The plan's own 'no verdict/measured field changed' grep check is coarse (line-level, not token-level): a path-only edit on a table row that also contains a pre-existing hex opcode (0x84, 0xffffffff) elsewhere on the same line trips the heuristic. Verified each such pair by hand instead of trusting the grep count alone."

key-files:
  created: []
  modified:
    - CLAUDE.md
    - README.md
    - docs/roadmap-stock-vice.md
    - docs/phase0-binmon-findings.md
    - docs/phase2-backend-probe-evidence.md
    - docs/phase9-regenerator2000-probe-findings.md

key-decisions:
  - "Fixed the Project Skills table's acme-build description drift rather than merely flagging it -- the plan's own instruction ('keep every description exactly as its playbook's own frontmatter states it') requires the table to mirror the playbook, and src/skills/acme-build/SKILL.md's frontmatter had already dropped the 'turn a .prg back into ACME source' clause when Phase 10 removed the disasm/toacme route; the table had not been updated to match."
  - "Consolidated README.md's stale 'internal .claude/mcp/vice + .claude/skills layout mirrors a project tree' claim into the existing 'Developing this repo: no in-repo autoload' section's framing (plan's own explicit instruction for exactly this overlap) rather than leaving two disagreeing statements -- the mirroring claim was true when the payload sat under .claude/ and is now false since it lives under src/, which is not on Claude Code's auto-discovery path."
  - "Left docs/phase1-probe-results.md's one .claude/mcp/vice/ mention untouched: it is a captured command-line transcript ('node .claude/mcp/vice/probe-binmon.mjs --selftest was run first and passed') recording the exact command executed on 2026-08-12, before src/mcp/vice/ existed. Rewriting it would falsify what was actually typed that day, distinct from the other three evidence documents' live pointers to where the authoritative file/fixture IS today."
  - "Verified rather than assumed: all four derived-tool interception line-number citations (vice-proxy.ts:3046/2981/1525/1501) were re-measured against the final source after plans 16-06 and 16-07 landed, by locating rewriteArguments()'s declaration and both call sites directly (not by trusting the plan-time reading) -- found unchanged, and the docs-linerefs.test.ts guard confirms this mechanically. No bullet edit was made or needed for Task 2, and no commit was required for it."

requirements-completed: [PKG-01]

coverage:
  - id: D1
    description: "Every reference in CLAUDE.md to either payload tree names its new src/ location or is a deliberately-preserved consumer-install path recorded as such; every backticked source path in the file exists on disk; the Project Skills table mirrors the six playbooks' own frontmatter descriptions exactly"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "node -e (Project Skills table row/path-existence check, inline in Task 1 verify block)"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "The architectural derived-tool interception citations (vice-proxy.ts line numbers) are re-measured against the final relocated source and confirmed current; the line-reference guard is green and non-vacuous; both interception sites (forwardToVice, gatherWedgeEvidence) are still named"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts (3 tests: non-vacuity, citation resolution, planted-violation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md's install/usage instructions name the new src/ paths for anything run from a checkout and the consumer's own layout for anything run after installing, distinguished rather than merged; the Layout diagram and the now-stale layout-mirror claim are corrected"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "grep -c 'src/mcp/vice\\|src/skills' README.md (returns 6)"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-fork-honesty.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Measured values, verdicts, captured outputs and dated conclusions inside docs/roadmap-stock-vice.md, docs/phase0-binmon-findings.md, docs/phase1-probe-results.md, docs/phase2-backend-probe-evidence.md and docs/phase9-regenerator2000-probe-findings.md are byte-identical before and after this plan -- only path pointers changed, and one genuine transcript line was left untouched"
    requirement: "PKG-01"
    verification:
      - kind: manual_procedural
        ref: "git diff 72ce495 -- docs/ -- every removed/added pair inspected by hand; 4 lines flagged by the coarse verdict/hex grep and confirmed to differ only by the path segment (see Evidence)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The tree-wide old-path grep, re-run across markdown after this plan, has every hit classified into exactly one of: plan-16-05-owned (now closed), deliberately-preserved consumer-install path, or deliberately-preserved historical narration/transcript -- no fourth category"
    requirement: "PKG-01"
    verification:
      - kind: manual_procedural
        ref: "Full tree-wide grep re-run and classified (see Evidence section below)"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 05: Documentation Sweep -- CLAUDE.md, README.md, docs/*.md Summary

**The phase's single documentation sweep repoints CLAUDE.md, README.md and four docs/*.md files from `.claude/mcp/vice`/`.claude/skills` to `src/mcp/vice`/`src/skills`, re-verifies all four `vice-proxy.ts` line-number citations against the final source (unchanged), fixes a pre-existing Project Skills table drift, and leaves every dated evidence value and one command-line transcript byte-identical.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-22T23:35:00Z (approx.)
- **Completed:** 2026-08-23T00:15:00Z
- **Tasks:** 3
- **Files modified:** 6 (CLAUDE.md, README.md, docs/roadmap-stock-vice.md, docs/phase0-binmon-findings.md, docs/phase2-backend-probe-evidence.md, docs/phase9-regenerator2000-probe-findings.md)

## Accomplishments

- **Task 1 — CLAUDE.md swept, 52 references repointed.** Every reference to `.claude/mcp/vice/` or `.claude/skills/` across the Project, Technology Stack, Configuration, Conventions, Architecture, and Project Skills sections now names `src/mcp/vice/` or `src/skills/`, except the one deliberately-preserved consumer-install literal (`<target>/.claude/skills/`, describing where the installer copies skills into *someone else's* project, line 245). All 39 backticked `src/...` paths in the file verified to exist on disk. `.claude-plugin/plugin.json` and `.mcp.json`'s own described paths (already `./src/skills/` and `src/mcp/vice/vice-proxy.ts` on disk, confirmed live) fell into place as part of the same sweep. No constraint's claim was reworded — every removed/added line pair in the diff differs only by the path segment, confirmed by direct inspection.
- **Found and fixed a real, pre-existing content drift while sweeping the Project Skills table:** the `acme-build` row's description still named "turn a .prg back into ACME source" — the `disasm`/`toacme` route Phase 10 (`R2000-05`) removed — while `src/skills/acme-build/SKILL.md`'s own frontmatter had already dropped that clause. Diffed all six table descriptions against their playbooks' frontmatter programmatically; five matched verbatim, one (acme-build) did not. Corrected the table to mirror the playbook exactly.
- **Task 2 — all four `vice-proxy.ts` line-number citations re-measured against the final source, found unchanged.** Located `rewriteArguments()`'s declaration (line 2003) and both call sites directly in the relocated `vice-proxy.ts`: the call inside `forwardToVice()` is still at line 3046 (function starts 2981), and the call inside `gatherWedgeEvidence()` is still at line 1525 (function starts 1501) — identical to the plan-time reading, confirming plans 16-06 and 16-07 (which added/edited nine other `stock-*.ts`/`disasm-*.ts` modules but never touched `vice-proxy.ts`) did not shift these lines. `docs-linerefs.test.ts`'s non-vacuity and planted-violation checks both pass. No bullet edit was made, and no commit was needed for this task.
- **Task 3 — README.md and four docs/*.md files swept, one transcript deliberately left alone.** README.md's own-tree references (node_modules install path, `THIRD-PARTY-NOTICES.md` link, `repo-root.ts`, `version.ts`, the `cd` command under "Developing / testing the MCP server", the Layout ASCII diagram) repointed to `src/`; the one `<project>/.claude/skills/` consumer-install mention left as-is. Rewrote README's now-contradictory "internal `.claude/mcp/vice` + `.claude/skills` layout mirrors a project tree" closing sentence — it was true when the payload sat under `.claude/` and became false the moment plan 16-04 moved it to `src/`, directly disagreeing with the "no in-repo autoload" section plan 16-01 had already added above it — into one consolidated, accurate statement. `docs/roadmap-stock-vice.md` (design prose, 4 references) repointed outright. `docs/phase0-binmon-findings.md` (4 references) and `docs/phase2-backend-probe-evidence.md` (5 references) had only the path text inside live pointers (naming the current authoritative script/fixture location) repointed — every measured value, byte count, and dated correction note left untouched. `docs/phase9-regenerator2000-probe-findings.md`'s one "To re-run:" instruction repointed (a forward-looking re-run instruction, not a captured transcript); `git diff --numstat` confirms exactly one line changed. `docs/phase1-probe-results.md`'s one mention — a captured command-line transcript from a specific 2026-08-12 run, predating the `src/` move — was deliberately left untouched. `docs/stock-vice-parity.md` confirmed to hold zero payload-path references, as expected.
- **Closed the tree-wide markdown enumeration.** Every remaining `.claude/(mcp/vice|skills)` hit across `*.md` (excluding `.planning/`, `.claude/gsd-core/`, `.claude/agents/`, `.claude/commands/`, `dist/`, `.gsd/`, `installer/skills/`) is now one of exactly two allowed categories: a deliberately-preserved consumer-install path (3 hits: `installer/README.md:18`, `README.md:32`, `CLAUDE.md:245`, all `<project>/.claude/skills/` or `<target>/.claude/skills/`) or the one deliberately-preserved historical transcript (`docs/phase1-probe-results.md:17`). A parallel non-markdown scan confirms the source-tree hits (`scripts/package.sh`'s `mustNotExist` literal, `installer/bin/cli.mjs`'s consumer-path prose, and ~17 historical-narration comments across `repo-root.ts`/`.test.ts`, `containerpath.ts`/`.test.ts`, `r2000-regbits-gen.ts`, `version.test.ts`, `r2000-regbits.test.ts`, `vice-proxy.test.ts`) are byte-identical to plan 16-04's own closing classification — no drift, no fourth category.

## Task Commits

1. **Task 1: Sweep CLAUDE.md — every path reference, the skills table, and nothing else** - `02b54d9` (docs)
2. **Task 2: Re-verify the architectural line-number citations against the final source, and record the check** - no commit (all four citations confirmed current; no bullet edit was needed or made)
3. **Task 3: Sweep README and the documentation directory, changing pointers and never evidence** - `29aec39` (docs)

**Plan metadata:** (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md commit, made immediately after this file)

## Files Created/Modified

- `CLAUDE.md` - all path references repointed to `src/mcp/vice`/`src/skills`; Project Skills table's acme-build description corrected
- `README.md` - own-tree paths repointed; Layout diagram updated; stale layout-mirror claim consolidated with the existing no-autoload section
- `docs/roadmap-stock-vice.md` - 4 "Critical files" pointers repointed
- `docs/phase0-binmon-findings.md` - 4 live-pointer paths repointed (probe script, fixture, authoritative implementation x2); all measured content untouched
- `docs/phase2-backend-probe-evidence.md` - 5 fixture-path pointers repointed; all measured/provenance content untouched
- `docs/phase9-regenerator2000-probe-findings.md` - 1 re-run-instruction path repointed; exactly one line changed, confirmed by `--numstat`

## Decisions Made

- **Fixed the acme-build Project Skills table drift rather than only flagging it.** The plan's own instruction requires the table to mirror the playbook's frontmatter exactly; a paraphrase (here, a stale capability claim) becomes a second source of truth. Corrected to match `src/skills/acme-build/SKILL.md` verbatim.
- **Consolidated README's stale layout-mirror sentence into the existing no-in-repo-autoload framing**, per the plan's own explicit instruction for this exact overlap, rather than leaving two sections quietly disagreeing about whether the repo's own tree still mirrors a consumer's installed layout (it does not, since the move to `src/`).
- **Left `docs/phase1-probe-results.md`'s one mention untouched** — a captured command-line transcript of what was literally typed on 2026-08-12, before `src/mcp/vice/` existed. This is the one occurrence in this plan's scope that is a transcript rather than a live pointer, and rewriting it would falsify the historical record.
- **Task 2 made no code change.** All four line-number citations (`vice-proxy.ts:3046/2981/1525/1501`) were re-measured directly against the current source and found identical to the plan-time reading; the honest action per the plan's own text is to confirm and record, not to edit something that is already correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Project Skills table's acme-build description named a capability removed in Phase 10**
- **Found during:** Task 1, diffing all six table descriptions against their playbooks' own frontmatter
- **Issue:** The table's acme-build row still read "...produce a C64 .prg, scaffold a new C64 program, list the symbols a program uses, or turn a .prg back into ACME source." The final clause names the `disasm`/`toacme` route, removed in v0.3.0 Phase 10 (`R2000-05`) and replaced by a regenerator2000 route. `src/skills/acme-build/SKILL.md`'s own frontmatter had already dropped that clause; CLAUDE.md's generated table had not been resynced.
- **Fix:** Updated the table row to match the playbook's frontmatter description exactly (verbatim, minus the stale clause).
- **Files modified:** `CLAUDE.md`
- **Verification:** Programmatic diff of all six descriptions against `src/skills/*/SKILL.md` frontmatter — 6/6 match after the fix (5 already matched).
- **Committed in:** `02b54d9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary for the plan's own acceptance criterion ("each description matches its playbook's own frontmatter description... quoting any difference in the SUMMARY"). No scope creep — the fix is confined to the one drifted table cell.

## Issues Encountered

The environment's `grep` is shadowed by `ugrep`, which omits the `./` path prefix `grep -r pattern .` normally emits. The plan's own tree-wide enumeration command (`grep -rnE ... . | grep -v '^\./\.planning/' | ...`) therefore passed every hit through unfiltered on a first run — none of the `^\./` anchors matched. Re-ran with prefix-agnostic exclusion patterns (`^\.?/?\.planning/` etc.); same effective scope, correct 4-hit result. Noted here since a future sweep in this environment will hit the same thing.

The plan's own "no verdict/measured field changed" grep (`git diff ... -- docs/ | grep -icE '(verdict|CONFIRMED|...|0x[0-9a-f]|65536)'`) is line-scoped, not token-scoped: it flagged 2 of `docs/phase2-backend-probe-evidence.md`'s fixture-table rows because the same physical lines that received the path edit also contain pre-existing, unchanged hex opcode literals (`0x84`, `0xffffffff`) later in the same row. Verified by direct inspection that each flagged pair differs **only** by the path segment (`.claude/mcp/vice/` -> `src/mcp/vice/`); no hex value, byte count, or verdict changed. Recorded here per the plan's own instruction to record any such exception with its reason.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The phase's documentation sweep is complete and ran exactly once, after every source-editing plan (16-01, 16-04, 16-06, 16-07) had landed, as the ROADMAP's own sequencing rationale required.
- No blockers. Full suite green throughout: `VICE_REQUIRE_ACME=1 npm test` — 2356 tests / 2312 pass / 0 fail / 39 skipped / 5 todo (unchanged from the pre-plan baseline); `docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts` all green (22/22 combined); `node scripts/check-skill-fork-honesty.mjs` OK (README.md's honesty corpus strings intact after the rewrite); `node scripts/check-npm-packages.mjs` OK (73/36-file tarballs unchanged); `bash scripts/package.sh` OK (970-file plugin zip).
- This is the last plan in Phase 16's plan list per the phase's own wave sequencing (16-05 depends on 16-04, 16-06, 16-07). Next step per STATE.md/ROADMAP.md is phase-level verification for Phase 16.

## Evidence (verbatim, per this plan's `<output>` spec)

### The four re-measured line numbers next to the four cited ones

| Citation in CLAUDE.md | Measured (this session, `src/mcp/vice/vice-proxy.ts`) | Match |
|---|---|---|
| `rewriteArguments()` call inside `forwardToVice()`: `:3046` | Line 3046: `const rewritten = rewriteArguments(args, name);` | identical |
| `forwardToVice()` starts: `:2981` | Line 2981: `async function forwardToVice(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {` | identical |
| `rewriteArguments()` call inside `gatherWedgeEvidence()`: `:1525` | Line 1525: `const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot");` | identical |
| `gatherWedgeEvidence()` starts: `:1501` | Line 1501: `async function gatherWedgeEvidence({ at, port, epoch }: IncidentAssetStemOptions): Promise<IncidentEvidence> {` | identical |

(`rewriteArguments()` itself is declared at line 2003, unchanged from the plan-time reading, though not itself a cited number.)

### Six Project Skills descriptions compared against the playbooks' frontmatter

| Skill | Match before this plan | Match after this plan |
|---|---|---|
| acme-build | **DIFF** — table said "...or turn a .prg back into ACME source.", frontmatter said "...or list the symbols a program uses." (no final clause) | MATCH (fixed) |
| c64-memory-mapping | MATCH | MATCH |
| c64-program-recon | MATCH | MATCH |
| c64-provenance-diff | MATCH | MATCH |
| c64-ram-capture | MATCH | MATCH |
| vice-wedge-triage | MATCH | MATCH |

### Every old-path hit deliberately left, with file, line, category and reason (markdown scan)

| File:Line | Text | Category | Reason |
|---|---|---|---|
| `installer/README.md:18` | `1. Copy the bundled skills into \`<project>/.claude/skills/\`` | deliberately-preserved consumer-install path | Names where the *installer* copies skills into a consumer's own project, not this repo's tree |
| `README.md:32` | `This copies the six skills into \`<project>/.claude/skills/\` and wires the` | deliberately-preserved consumer-install path | Same — describes the npm-installer's target layout in someone else's project |
| `CLAUDE.md:245` | `- Responsibilities: copy \`installer/skills/\` into \`<target>/.claude/skills/\`,` | deliberately-preserved consumer-install path | Same — `installer/bin/cli.mjs`'s own documented responsibility, target is a consumer project |
| `docs/phase1-probe-results.md:17` | `` `node .claude/mcp/vice/probe-binmon.mjs --selftest` was run first and passed `` | deliberately-preserved historical transcript | Records the exact command executed on 2026-08-12, before `src/mcp/vice/` existed; rewriting would falsify the record |

No fourth category. Every hit above was already correctly classified before this plan (as consumer-install or evidence-transcript) and required no plan-16-05 ownership — the plan-16-05-owned set (`CLAUDE.md`, `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/phase2-backend-probe-evidence.md`, `docs/phase9-regenerator2000-probe-findings.md`, `docs/roadmap-stock-vice.md`) that 16-04 identified is now fully closed.

A parallel non-markdown scan (`*.ts`/`*.mts`/`*.mjs`/`*.json`/`*.sh`/`*.yml`/`*.a`, same exclusions) found the identical source-tree hits plan 16-04 already closed and classified — `scripts/package.sh`'s `mustNotExist` detection literal, `installer/bin/cli.mjs`'s consumer-path prose, and ~17 historical-narration comments across `repo-root.ts`/`.test.ts`, `containerpath.ts`/`.test.ts`, `r2000-regbits-gen.ts`, `version.test.ts`, `r2000-regbits.test.ts`, `vice-proxy.test.ts` — byte-identical to 16-04's own final classification. This plan's `files_modified` scope does not include any of these files, and none were touched.

### Full `npm test` counter block (final, after Task 3)

```
# tests 2356
# suites 23
# pass 2312
# fail 0
# cancelled 0
# skipped 39
# todo 5
# duration_ms 92613.592134
```

### Document guards (final)

```
$ cd src/mcp/vice && node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts docs-review-disposition.test.ts
# tests 22
# pass 22
# fail 0
```

### Packaging validators (final)

```
$ node scripts/check-skill-fork-honesty.mjs
check-skill-fork-honesty: OK -- ... README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones

$ node scripts/check-npm-packages.mjs
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 73 files
  @henols/c64-re-tools@0.0.0-dev -- 36 files, 6 skills

$ bash scripts/package.sh
package: manifests OK (plugin "c64-re-tools" v0.0.0-dev)
package: done: files 970
```

## Self-Check: PASSED

- FOUND: `CLAUDE.md` names `src/mcp/vice/vice-proxy.ts` and `src/skills/acme-build/SKILL.md`, both exist on disk
- FOUND: `README.md` names `src/mcp/vice/repo-root.ts`, exists on disk
- FOUND commit `02b54d9` in git history
- FOUND commit `29aec39` in git history
- All plan-level `<verification>` commands re-run live in this session: `grep -cE '\.claude/(mcp/vice|skills)' CLAUDE.md` returns 1 (the one deliberately-preserved consumer path, listed above); every backticked `src/...` path in `CLAUDE.md` confirmed to exist; `docs-linerefs.test.ts`/`docs-dangling-refs.test.ts`/`docs-deferred-ledger.test.ts`/`docs-review-disposition.test.ts` all green (22/22); `VICE_REQUIRE_ACME=1 npm test` 2356/2312/0-fail; `check-skill-fork-honesty.mjs`, `check-npm-packages.mjs`, `package.sh` all exit 0; `git diff 72ce495 -- docs/` verdict/hex grep returns 4 (all 4 confirmed path-only edits sharing a line with a pre-existing, unchanged hex literal — see Issues Encountered); every remaining old-path markdown hit listed above with category and reason. No missing items.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*
