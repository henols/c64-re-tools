---
phase: 16-packaging-and-repo-shape
plan: 04
subsystem: packaging
tags: [claude-code-plugin, npm-packaging, mcp-server-relocation, repo-layout]

requires:
  - phase: 16-packaging-and-repo-shape
    provides: "plan 16-01's proven relocation machinery (git mv + literal sweep + mustNotExist gate), rehearsed on the smaller skills tree"
provides:
  - src/mcp/vice/ as the new canonical location for the published @henols/vice-mcp package
  - every functional consumer repointed in the same commit as the move (.mcp.json, scripts/*, CI, .gitignore, THIRD-PARTY-NOTICES.md)
  - scripts/package.sh's mustNotExist list now carries both payload entries (.claude/skills from 16-01, .claude/mcp/vice added here)
  - repoRoot()'s branch-4 hop count reviewed-and-unchanged, recorded explicitly in repo-root.ts's own relocation header
  - repo-root.test.ts's synthetic fixture rebuilt at the new shape, plus a second case pinning the hop count as a depth property
  - the register-bits generated banner regenerated to name the new directory
  - roughly two dozen stale .claude/skills self-references inside src/skills/ and src/mcp/vice/ that plan 16-01's own sweep missed, now fixed
affects: [16-05, 16-06, 16-07]

actuals:
  tokens: 34600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Re-enumerate from the live tree before trusting a plan-time consumer list -- a fresh grep at execution time caught scripts/version.mjs's SEAM_PATH, audit-integrity.test.ts's synthetic-tree helper, and two real path-agreement tests in repo-root.test.ts, all missed because they build the old path from segmented join() arguments rather than the literal path string."
    - "Reviewed-and-unchanged is a recorded fact, not a silent non-edit -- repo-root.ts's relocation header narrates the fourth move and explicitly states the hop count was reviewed, matching the file's own established convention for its three prior relocations."

key-files:
  created: []
  modified:
    - src/mcp/vice/ (whole directory, git mv'd from .claude/mcp/vice/, 210 files)
    - .mcp.json
    - scripts/ensure-mcp-deps.sh
    - scripts/package.sh
    - scripts/check-npm-packages.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/generate-tool-support-table.mjs
    - scripts/version.mjs
    - scripts/audit-gate.mjs
    - scripts/lib/anno-cli-verbs.mjs / .d.mts
    - scripts/lib/skill-honesty-checks.mjs / .d.mts
    - scripts/lib/skill-corpus.mjs
    - .github/workflows/ci.yml
    - .gitignore
    - THIRD-PARTY-NOTICES.md
    - installer/bin/cli.mjs
    - installer/README.md
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/repo-root.test.ts
    - src/mcp/vice/resources/vice-launcher.sh
    - src/mcp/vice/anno-regbits-gen.ts / anno-regbits.json
    - src/skills/**/SKILL.md and scripts (stale .claude/skills self-references from plan 16-01)

key-decisions:
  - "D-16-04 (from the plan): no compatibility shim, no major version bump -- the published tarball's 73-entry path list is package-relative and unaffected by the directory move, proven byte-identical to plan 16-01's baseline."
  - "The mustNotExist entry added is the literal .claude/mcp/vice (not the broader .claude/mcp), matching exactly what the plant-and-remove acceptance test exercises."
  - "Kept two classes of remaining .claude/mcp/vice and .claude/skills mentions deliberately unedited: historical narration describing prior relocations (repo-root.ts/.test.ts's move history, containerpath.ts/.test.ts's retired devcontainer-host-path skill, anno-regbits-gen.ts/.test.ts's plan-16-01 deviation note, this plan's own added version.test.ts note) and consumer-install-path/detection literals (installer's <target>/.claude/skills/, scripts/package.sh's mustNotExist check)."

requirements-completed: [PKG-01]

coverage:
  - id: D1
    description: "The MCP server package relocated from .claude/mcp/vice/ to src/mcp/vice/ in one atomic rename commit, with every functional consumer repointed in the same commit"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test"
        status: pass
      - kind: unit
        ref: "node scripts/check-npm-packages.mjs"
        status: pass
      - kind: unit
        ref: "node scripts/check-skill-tool-coverage.mjs"
        status: pass
      - kind: unit
        ref: "node scripts/check-skill-fork-honesty.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The published @henols/vice-mcp tarball is byte-for-byte unaffected by the move -- 73-entry sorted path list identical to plan 16-01's pre-move baseline"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm pack --dry-run --json (diffed against plan 16-01's recorded baseline)"
        status: pass
    human_judgment: false
  - id: D3
    description: "repoRoot()'s branch-4 hop count is asserted correct and provably untouched; the standing caution now forbids only the nesting move it was written about"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/repo-root.test.ts (10 tests, incl. the two synthetic last-resort cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/package.sh fails closed on either payload directory (.claude/skills or .claude/mcp/vice) reappearing at the repository root, proven by a live plant-and-remove"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "bash scripts/package.sh (planted .claude/mcp/vice -> exit 1; removed -> exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The tree-wide enumeration for both the old MCP-server path and the old skills path is closed -- every remaining hit classified as plan-16-05-owned, deliberately-preserved, or evidence-immutable, with no fourth category"
    requirement: "PKG-01"
    verification:
      - kind: manual_procedural
        ref: "Full tree-wide grep re-run and manually classified (see Evidence section below)"
        status: pass
    human_judgment: false

duration: ~55min (estimated)
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 04: Relocate MCP Server Package to src/mcp/vice/ Summary

**Moved the ~180-file `@henols/vice-mcp` package from `.claude/mcp/vice/` to `src/mcp/vice/` in one atomic `git mv`, repointed roughly 30 functional consumers (manifest, five packaging/CI scripts, five corpus-coverage scripts, CI workflow's cache key and six working-directory entries, `.gitignore`, `THIRD-PARTY-NOTICES.md`) plus the depth-critical `repoRoot()` record, regenerated the one committed artifact whose banner named the old directory, and closed a fresh tree-wide enumeration that caught roughly two dozen stale `.claude/skills` self-references plan 16-01's own sweep had missed — all verified against the full 2293-test glob with zero regression from the pre-move baseline and the published tarball proven byte-identical.**

## Performance

- **Duration:** ~55 min (estimated)
- **Started:** 2026-08-23T00:10:00Z (approx.)
- **Completed:** 2026-08-23T00:45:00Z
- **Tasks:** 3
- **Files modified:** 238 (210 renamed + edited `src/mcp/vice/` files; 17 consumer files in Task 1; 3 files in Task 2; 23 files in Task 3, including the ~22 stray `.claude/skills` fixes)

## Accomplishments

- `@henols/vice-mcp` now lives at `src/mcp/vice/`; `.claude/mcp/` no longer exists. The move landed as a single `git mv` commit (`R099`–`R100` for every file, 210 renames).
- Every functional consumer repointed in the same commit as the move: `.mcp.json`'s `args[0]`, `scripts/ensure-mcp-deps.sh`'s `MCP_DIR`, `scripts/package.sh`'s manifest reads / `mustExist` array / new `mustNotExist` entry, `scripts/check-npm-packages.mjs`'s two `packFiles()` sites plus the `THIRD-PARTY-NOTICES.md` pointer assertion, `scripts/check-skill-tool-coverage.mjs`/`check-skill-fork-honesty.mjs`/`generate-tool-support-table.mjs`'s imports and constants, `scripts/version.mjs`'s `SEAM_PATH`, `scripts/audit-gate.mjs`'s prose and two `viceDir` functional literals, `scripts/lib/*` header prose, CI's `cache-dependency-path` and six `working-directory` entries, `.gitignore`'s three comments, `THIRD-PARTY-NOTICES.md`'s pointer, and the module's own `package.json` `repository.directory`.
- Found and fixed three functional literals the re-enumeration's plain-string grep missed because they build the old path from segmented `join()` arguments rather than the literal string `.claude/mcp/vice`: `scripts/version.mjs`'s `SEAM_PATH`, `audit-integrity.test.ts`'s shared synthetic-tree helper (`buildSyntheticTree()`, used by 15+ test cases), and `repo-root.test.ts`'s two real `repoRoot()`-driven path-agreement tests. All caught live by the first post-move `npm test` run (19 failures), fixed, and re-verified to zero regression.
- `repoRoot()`'s three-segment depth (`src`/`mcp`/`vice`) is asserted, not assumed, identical to the old `.claude`/`mcp`/`vice` shape; both `resolve(from, "..", "..", "..")` call sites are byte-identical (verified by diff, count still 2). `repo-root.ts`'s relocation header gains a fourth entry stating the hop count was "reviewed and left unchanged."
- `repo-root.test.ts`'s synthetic last-resort fixture is rebuilt at the new `src/mcp/vice` shape, and a second synthetic case was added pinning the OLD `.claude/mcp/vice` shape too, so the hop count is proven as a property of depth (three segments) rather than of one particular directory name (5 tests before this task, 6 after).
- The standing caution in `repo-root.test.ts` now explicitly distinguishes nesting authored sources one level deeper INSIDE the module directory (forbidden, would make four) from relocating the same three-segment shape elsewhere directly under the root (what this phase did, and does not break the hop count).
- The register-bits generated artifact (`anno-regbits.json`) was regenerated from its generator (never hand-edited) so its committed banner names the new directory; both banner copies verified identical.
- Closed the tree-wide enumeration: a fresh grep for both the old MCP-server path and the old skills path found ~22 stale `.claude/skills` self-references inside `src/skills/**` (SKILL.md files, `template.a`, scripts) and `src/mcp/vice/*` that plan 16-01's own sweep had missed, plus `scripts/lib/skill-corpus.mjs` and this package's own `THIRD-PARTY-NOTICES.md`. All fixed; every remaining hit after the fix classifies into exactly one of the three allowed categories (see Evidence).

## Task Commits

1. **Task 1: Re-enumerate the consumer set from the live tree, then move the directory and update every functional consumer in one commit** - `c77edee` (feat)
2. **Task 2: Resolve the repo-root depth record** - `b285767` (feat)
3. **Task 3: Regenerate the register-bits banner, close the enumeration** - `7295e20` (feat)

**Plan metadata:** (this SUMMARY + STATE.md/ROADMAP.md commit, made immediately after this file)

## Files Created/Modified

- `src/mcp/vice/**` (210 files, `git mv`'d from `.claude/mcp/vice/`, byte-identical except the ~40 files with functional/prose literal repoints)
- `.mcp.json`, `scripts/ensure-mcp-deps.sh`, `scripts/package.sh` - functional literal repoints + `mustNotExist` second entry
- `scripts/check-npm-packages.mjs`, `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-fork-honesty.mjs`, `scripts/generate-tool-support-table.mjs`, `scripts/version.mjs`, `scripts/audit-gate.mjs`, `scripts/lib/*` - imports, constants, and prose repointed
- `.github/workflows/ci.yml` - cache key + 6 working-directory entries
- `.gitignore`, `THIRD-PARTY-NOTICES.md`, `installer/bin/cli.mjs`, `installer/README.md` - prose repoints (installer's `<target>/.claude/skills/` consumer-install mentions deliberately left unchanged)
- `src/mcp/vice/repo-root.ts`, `repo-root.test.ts`, `resources/vice-launcher.sh` - depth record resolved
- `src/mcp/vice/anno-regbits-gen.ts`, `anno-regbits.json` - banner regenerated
- `scripts/lib/skill-corpus.mjs`, `src/mcp/vice/{disasm-opcodes,disasm-roundtrip.test,anno-confidence,anno-d64,anno-symbols,stock-cia,stock-sprites,stock-timing,stock-vicii}.ts`, `src/skills/**/SKILL.md` and scripts, `src/skills/acme-build/template.a` - stray `.claude/skills` staleness from plan 16-01 closed

## Decisions Made

- **D-16-04 (from the plan, confirmed):** no compatibility shim, no major version bump. Verified by direct 73-entry path-list comparison against plan 16-01's recorded baseline — identical.
- **`mustNotExist`'s second entry is `.claude/mcp/vice`, not `.claude/mcp`:** matches the exact directory the plant-and-remove acceptance test exercises, and does not risk asserting on `.claude/mcp` as a whole (which does not exist as a concept independent of the `vice` subdirectory).
- **Historical narration left unedited:** `repo-root.ts`/`repo-root.test.ts`'s prior-move history, `containerpath.ts`/`.test.ts`'s reference to the long-retired `devcontainer-host-path` skill (a different, deleted directory — not one of the six shipped skills), `anno-regbits-gen.ts`/`.test.ts`'s note about plan 16-01's own deviation, `vice-proxy.test.ts`'s citation of a past plan's `git diff` command, and this plan's own added `version.test.ts` note are all accurate history and were left as-is rather than rewritten.
- **Fixed the ~22 stray `.claude/skills` mentions inside `src/skills/**` and `src/mcp/vice/*` rather than deferring them:** they did not fit any of the three allowed leftover categories (not root/docs markdown owned by plan 16-05, not a consumer-install path, not evidence-immutable), so per the plan's own "no fourth category" rule they were missed consumers to fix, not to classify away.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three functional path literals outside the plan's own enumeration broke the first post-move test run**
- **Found during:** Task 1, running the first post-move `VICE_REQUIRE_ACME=1 npm test` (19 failures against the 2292/2248/0 baseline)
- **Issue:** `scripts/version.mjs`'s `SEAM_PATH`, `audit-integrity.test.ts`'s `buildSyntheticTree()` helper, and `repo-root.test.ts`'s two `repoRoot()`-driven path-agreement tests each built the old module-directory path from segmented `join(x, ".claude", "mcp", "vice")` arguments rather than the literal string `.claude/mcp/vice` — invisible to a plain-string grep enumeration. `audit-integrity.test.ts`'s helper alone was shared by 15+ test cases (all of `audit-gate.mjs`'s planted-violation and hook-mode coverage), so one missed literal produced most of the 19 failures.
- **Fix:** Repointed all four sites to `src`/`mcp`/`vice`. Also found and fixed the same class of miss in `anno-cli.test.ts`'s expected-`--help`-output regex, which used escaped-slash JS-regex syntax (`\.claude\/mcp\/vice\/`) invisible to both the plain-string enumeration grep and a plain-string `sed` replacement.
- **Files modified:** `scripts/version.mjs`, `src/mcp/vice/audit-integrity.test.ts`, `src/mcp/vice/repo-root.test.ts`, `src/mcp/vice/anno-cli.test.ts`
- **Verification:** Re-ran `VICE_REQUIRE_ACME=1 npm test` — 2292 tests, 2248 pass, 0 fail, 39 skipped, 5 todo, 23 suites — exactly matching the pre-move baseline.
- **Committed in:** `c77edee` (Task 1 commit)

**2. [Rule 3 - Blocking] scripts/package.sh's mustNotExist plant left a stray empty `.claude/mcp` directory after the git mv**
- **Found during:** Task 1, immediately after the `git mv`
- **Issue:** `git mv .claude/mcp/vice src/mcp/vice` left an empty `.claude/mcp` directory behind (git only tracks files, not empty directories), which made `test ! -d .claude/mcp` fail in the plan's own verify block.
- **Fix:** `rmdir .claude/mcp` (empty, untracked, safe).
- **Files modified:** none (filesystem-only, no tracked content)
- **Verification:** `test ! -d .claude/mcp` passes; `git status --porcelain` unaffected.
- **Committed in:** N/A (no tracked change; the directory was never in the index)

**3. [Rule 1 - Bug] ~22 stale `.claude/skills` self-references inside src/skills/** and src/mcp/vice/* missed by plan 16-01's own sweep**
- **Found during:** Task 3's closing enumeration
- **Issue:** Plan 16-01 moved the six skills to `src/skills/` but its own consumer sweep missed most of the skills' own internal self-references: `SKILL.md` files' "from the repo root" invocation examples, `acme-build/template.a`'s build comment, `c64-provenance-diff/scripts/diff-images.mjs`'s generated-Markdown banner text, `c64-ram-capture/scripts/{project-paths,watch-loads}.mjs`'s comments, plus `scripts/lib/skill-corpus.mjs` and this plan's own package's `THIRD-PARTY-NOTICES.md`.
- **Fix:** Repointed every one to `src/skills/` (or `src/mcp/vice/` where the reference was to the MCP server rather than a skill). None fit the plan's three allowed leftover categories, so per its own "no fourth category" rule these were missed consumers to fix.
- **Files modified:** `scripts/lib/skill-corpus.mjs`, `src/mcp/vice/{disasm-opcodes,disasm-roundtrip.test,anno-confidence,anno-d64,anno-symbols,stock-cia,stock-sprites,stock-timing,stock-vicii}.ts`, `src/mcp/vice/THIRD-PARTY-NOTICES.md`, `src/skills/acme-build/{SKILL.md,template.a}`, `src/skills/c64-memory-mapping/SKILL.md`, `src/skills/c64-program-recon/{SKILL.md,templates/memory-map.template.md}`, `src/skills/c64-provenance-diff/{SKILL.md,scripts/diff-images.mjs}`, `src/skills/c64-ram-capture/{SKILL.md,scripts/project-paths.mjs,scripts/watch-loads.mjs}`
- **Verification:** Full tree-wide grep re-run afterward returns only the deliberately-preserved and historical-narration set (see Evidence); typecheck clean; full test glob green.
- **Committed in:** `7295e20` (Task 3 commit)

**4. [Rule 1 - Bug] version.test.ts's :66 comment named the old path even though the plan instructed leaving it unchanged**
- **Found during:** Task 1
- **Issue:** The plan's own action text said to "leave the three-levels-up comment at :66 as-is: it is still true," but the comment's literal text (`// HERE is .claude/mcp/vice/ ...`) names the pre-move directory by name, which would make Task 3's "enumeration closed" acceptance criterion fail on this file (no allowed leftover category fits a plain stale location name in a non-historical comment).
- **Fix:** Updated the location name to `src/mcp/vice/` while explicitly preserving the substance the plan asked to keep true (the three-levels-up hop count claim, plus an added clause noting it's unchanged from the pre-move depth).
- **Files modified:** `src/mcp/vice/version.test.ts`
- **Verification:** `node --test version.test.ts` passes; enumeration grep no longer flags this line as a live location claim (it is now correctly current).
- **Committed in:** `c77edee` (Task 1 commit)

**5. [Rule 3 - Blocking] The plan's own anno-regbits.json banner-check verify command reads a nonexistent field path**
- **Found during:** Task 3
- **Issue:** The plan's `<acceptance_criteria>` verify command for the banner checks `json.warning||(json.meta&&json.meta.warning)`, but the real committed structure nests the warning at `json._generated.warning`. Run verbatim, the command throws `Error: no warning banner found`.
- **Fix:** No code changed for this — the underlying banner IS correct and regenerated. Verified with a corrected field path (`json._generated.warning`) matching `anno-regbits-gen.ts`'s own `buildRegBitsDocument()` and `anno-regbits.test.ts`'s own existing assertions, both of which read `_generated.warning`.
- **Files modified:** none (verification-only correction)
- **Verification:** Corrected command prints "banner OK"; `node --test anno-regbits.test.ts` (16 tests) passes.
- **Committed in:** N/A (documentation-only note, no code change needed)

---

**Total deviations:** 5 auto-fixed (3 blocking/Rule 3, 2 bug-fix/Rule 1)
**Impact:** All five were necessary for the plan's own gates to pass or for the enumeration-closure requirement to hold. No scope creep beyond the plan's own explicit "close the enumeration ... a missed consumer... this task is not done" mandate. The largest (deviation 1) is exactly the class of gap plan 16-01's tracer was designed to surface at the smaller scale — segmented `join()` path construction invisible to a literal-string grep — and it recurred here at the larger scale despite the warning, confirming the tracer's own stated purpose.

## Issues Encountered

The `git diff HEAD~1 -- <pathspec>` form of two acceptance-criteria commands (the `resources/` zero-content-change check and the `vice-proxy.test.ts` network-guard-unchanged check) produced misleading "fully added" diffs due to a git rename-detection limitation: when a `--` pathspec matches only the NEW side of a rename pair, git's heuristic pairing can fail to find the OLD side and falls back to showing the whole new file as added. Verified both properties directly instead: `diff <(git show HEAD~1:<old-path>) <(git show HEAD:<new-path>)` for `resources/*` (byte-identical, confirmed for all 9 files) and for `vice-proxy.test.ts` (exactly one line differs — the test title string — confirmed the network-call `offenders` array is untouched). Cross-checked with `git diff HEAD~1 HEAD -M --name-status` (no pathspec), which correctly reports both as `R100`/`R099` renames.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/mcp/vice/` is the proven, gate-verified target layout for the MCP server package. Plans 16-06 and 16-07 (both adding test files under `src/mcp/vice/`) can proceed directly against this location.
- Plan 16-05 (documentation sweep, including CLAUDE.md, README.md, and `docs/*.md`) has a clean, closed starting enumeration: all 6 remaining root/docs-markdown hits are the only files it needs to touch for this plan's move (CLAUDE.md, `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/phase2-backend-probe-evidence.md`, `docs/phase9-external-analyser-probe-findings.md`, `docs/roadmap-stock-vice.md`).
- No blockers. Full 2293-test glob green, typecheck clean, smoke test passing (78 tools advertised), all five packaging/corpus validators green, published tarball proven byte-identical to the pre-move baseline.

## Evidence (verbatim, per this plan's `<output>` spec)

### Functional-vs-prose consumer enumeration (re-run from the live tree, Task 1)

Functional consumers (path built/asserted at runtime, import specifier, manifest field, CI working directory, `mustExist`/`files[]` entry, or user-facing string) repointed in Task 1's commit: `.mcp.json` (1), `scripts/ensure-mcp-deps.sh` (2), `scripts/package.sh` (5 sites + mustNotExist list), `scripts/check-npm-packages.mjs` (4 sites), `scripts/check-skill-tool-coverage.mjs` (2), `scripts/check-skill-fork-honesty.mjs` (2), `scripts/generate-tool-support-table.mjs` (3), `scripts/version.mjs` (2, including the segmented-literal `SEAM_PATH` caught by the first test run), `scripts/audit-gate.mjs` (2 functional `viceDir` literals + 3 prose), `.github/workflows/ci.yml` (7: 1 cache key + 6 working-directory), `src/mcp/vice/package.json` (`repository.directory`), `src/mcp/vice/version.test.ts` (2 functional literals + 1 comment), `src/mcp/vice/assumption-label-discipline.test.ts` (2 functional + 3 header), `src/mcp/vice/host-scripts.test.ts` (1 functional array entry + 1 comment), `src/mcp/vice/anno-cli.ts` (1 user-facing string + 1 stale `.claude/skills` comment), `src/mcp/vice/probe-binmon.mjs` (6 usage-text paths), `src/mcp/vice/audit-integrity.test.ts` (1 shared synthetic-tree-helper literal, found live), `src/mcp/vice/repo-root.test.ts` (2 real path-agreement literals, found live), `src/mcp/vice/anno-cli.test.ts` (1 escaped-regex literal, found live). Prose-only mentions repointed inside the module directory across ~25 files (`build.ts`, `build-atomic.test.ts`, `broker-kill.test.ts`, `containerpath.ts`, `docs-dangling-refs.test.ts`, `hostpath.ts`, `hostpath-consumers.test.ts`, `install-resources.ts`, `load-order.test.ts`, several `anno-*.ts`/`.test.ts`, several `stock-*.ts`, `stock-connect.test.ts`, `telemetry-import.test.ts`, `test-gate.mjs`, `version.ts`, `vice-proxy.ts`, `vice-proxy.test.ts`'s test title, `resources/vice-launcher.sh`) plus `.gitignore` (3), `THIRD-PARTY-NOTICES.md` (1), `installer/bin/cli.mjs` (2), `scripts/lib/*` (5 header prose across 4 files).

### Post-move `npm pack --dry-run --json` path list vs. plan 16-01's baseline

```
73 entries, sorted, byte-for-byte identical to plan 16-01's recorded 73-entry list.
bin["vice-mcp"] = "vice-proxy.ts" (unchanged)
main = "vice-proxy.ts" (unchanged)
files.length = 64 (package.json files[] entries; unchanged)
repository.directory = "src/mcp/vice"
```
Diff against the exact 73-line list plan 16-01 recorded in its own SUMMARY: no differences.

### Full `npm test` counter block (final, after Task 3)

```
# tests 2293
# suites 23
# pass 2249
# fail 0
# cancelled 0
# skipped 39
# todo 5
# duration_ms 95104.155361
```
(2292/2248 pre-move baseline + 1 test / 1 pass from the added `repo-root.test.ts` synthetic case pinning the old-shape depth property.)

### Segment-count depth assertion

```
$ node -e 'const p="src/mcp/vice".split("/");if(p.length!==3)throw new Error(...);console.log("depth OK: 3 segments");'
depth OK: 3 segments
```
Both `resolve(from, "..", "..", "..")` call sites in `repo-root.ts` are present, unchanged (count still 2, confirmed by `git diff` showing zero added/removed lines matching that pattern).

### Both quoted sentences from `repo-root.test.ts`'s corrected standing caution

> "THE DISTINCTION THIS COMMENT MUST DRAW (phase 16-04): what breaks this hop count is adding a FOURTH level INSIDE the flat module directory -- nesting authored TypeScript one level deeper than `src/mcp/vice/` itself (siblings of resources/), the exact move the 01.6.1-era version of this comment warned against."

> "What does NOT break it is relocating the same three-segment shape elsewhere directly under the repo root, which is what phase 16-04 did: `.claude/mcp/vice/` -> `src/mcp/vice/`, still three segments below the root. A future reader proposing to nest sources one level deeper inside this module directory should still read this comment before doing it; a future reader merely relocating this same three-segment directory elsewhere under the root is not the move this comment forbids."

### Planted-directory failure output and green re-run (Task 1)

Planted:
```
$ mkdir -p .claude/mcp/vice && bash scripts/package.sh; echo "exit=$?"
package: validating plugin manifests and layout ...
package: manifest/layout validation failed:
  - .claude/mcp/vice exists at the repository root -- the payload must activate only when installed, not by repo-root auto-discovery
exit=1
```

Removed and re-run:
```
$ rm -rf .claude/mcp && bash scripts/package.sh; echo "exit=$?"
package: validating plugin manifests and layout ...
package: manifests OK (plugin "c64-re-tools" v0.0.0-dev)
package: building /home/henrik/dev/henrik/git/c64-re-tools/dist/c64-re-tools-0.0.0-dev.zip from tracked files at HEAD ...
package: done:
  artifact : /home/henrik/dev/henrik/git/c64-re-tools/dist/c64-re-tools-0.0.0-dev.zip
  files    : 960
  sha256   : 20c330b9ac0a85355831f915a1ffe7666777e0224f3ec76c2e9823b81955e2e6
exit=0
```
`git status --porcelain` showed no stray artifact afterward.

### Classification of every remaining old-path grep hit (Task 3, final closing sweep)

Tree-wide grep for `\.claude/(mcp/vice|skills)` across `*.ts`/`*.mts`/`*.mjs`/`*.json`/`*.sh`/`*.yml`/`*.md`/`*.a`, excluding node_modules, dist/, `.planning/`, and the local agent-tooling directories, after Task 3's fixes:

**Plan-16-05-owned (root markdown + docs/*.md, 6 files):** `CLAUDE.md`, `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/phase2-backend-probe-evidence.md`, `docs/phase9-external-analyser-probe-findings.md`, `docs/roadmap-stock-vice.md`.

**Deliberately-preserved (consumer-install path / detection literal, 3 files):** `installer/bin/cli.mjs` and `installer/README.md` (both describe copying skills into `<target>/.claude/skills/` — the *consumer's* project layout, a route this plan does not touch); `scripts/package.sh` (the `mustNotExist` literal `.claude/mcp/vice` must keep naming the OLD path — that is the value the gate checks for absence of, not a location to repoint).

**Deliberately-preserved (historical narration, accurate as history, 8 files):** `src/mcp/vice/repo-root.ts` and `repo-root.test.ts` (narrate the tree's three prior relocations, including the retired `.claude/skills/vice-session/` and `.claude/skills/vice-mcp-selector/` homes, plus repo-root.test.ts's own deliberate old-shape synthetic test); `src/mcp/vice/containerpath.ts` and `containerpath.test.ts` (reference the long-retired, since-deleted `devcontainer-host-path` skill — a different directory from the six shipped skills, correctly described as history); `src/mcp/vice/anno-regbits-gen.ts` and `anno-regbits.test.ts` (document plan 16-01's own `MEMMAP_PATH` deviation, correctly past-tense); `src/mcp/vice/version.test.ts` (this plan's own added note explicitly marked "pre-move"); `src/mcp/vice/vice-proxy.test.ts` (cites a specific historical `git diff` invocation from plan 01.1-03's own verification, not a current claim).

**No fourth category.** Every hit above fits one of the three allowed classifications; the ~22 hits that did NOT fit any of the three (stale `.claude/skills` self-references inside `src/skills/**` and a handful of `src/mcp/vice/*.ts` files, plus `scripts/lib/skill-corpus.mjs` and this package's own `THIRD-PARTY-NOTICES.md`) were fixed rather than classified, per deviation 3 above.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.ts`
- FOUND: `src/mcp/vice/repo-root.ts`
- FOUND: `src/mcp/vice/package.json`
- FOUND: `src/mcp/vice/resources/vice-launcher.sh`
- FOUND commit `c77edee` in git history
- FOUND commit `b285767` in git history
- FOUND commit `7295e20` in git history
- All acceptance criteria and plan-level `<verification>` commands re-run live in this session; results recorded above (Evidence section). No missing items.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*
