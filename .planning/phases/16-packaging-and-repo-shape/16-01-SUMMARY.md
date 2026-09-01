---
phase: 16-packaging-and-repo-shape
plan: 01
subsystem: packaging
tags: [claude-code-plugin, npm-packaging, skills-relocation, repo-layout]

requires:
  - phase: 15-debt-and-review-disposition
    provides: pending-todo tree reduced to 2, both promoted to named Phase 16 requirements (PKG-01, PKG-03)
provides:
  - src/skills/ as the new canonical location for the six shipped skills
  - a repointed plugin manifest, packaging validator, both skill-corpus CI checks,
    the installer's skill-sync source, CI's own working paths, and the three
    skills-path literals inside the vice-mcp test suite
  - a HERE-relative, existence-asserting SCAN_DIRS in recovery-schema.mjs
  - scripts/package.sh's mustNotExist payload-absence check (skills entry only;
    plan 16-04 adds the MCP-server entry)
  - README.md's dev-time story for the loss of in-repo autoload
affects: [16-02, 16-03, 16-04, 16-05, 16-06, 16-07]

actuals:
  tokens: 58000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "HERE-relative sibling-scan with a loud existence assertion (recovery-schema.mjs), replacing a project-root-relative literal that silently stops resolving when a tree moves"
    - "mustNotExist payload-absence list in scripts/package.sh, driven from a single constant a later plan extends rather than a second hand-rolled check"

key-files:
  created: []
  modified:
    - src/skills/ (all six directories, moved via git mv from .claude/skills/)
    - .claude-plugin/plugin.json
    - scripts/package.sh
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - installer/scripts/sync-skills.mjs
    - .github/workflows/ci.yml
    - .claude/mcp/vice/anno-verb-coverage.test.ts
    - .claude/mcp/vice/anno-symbol-roundtrip.test.ts
    - .claude/mcp/vice/skill-honesty-checks.test.ts
    - .claude/mcp/vice/anno-regbits-gen.ts
    - .claude/mcp/vice/anno-regbits.test.ts
    - .claude/mcp/vice/stock-a4-checkpoint-flood.test.ts
    - src/skills/c64-provenance-diff/scripts/recovery-schema.mjs
    - src/skills/c64-provenance-diff/scripts/diff-images.mjs
    - README.md
    - src/skills/acme-build/SKILL.md

key-decisions:
  - "Target layout confirmed as src/skills/ (D-16-01), unconstrained for the skills half; the depth-preserving constraint (src/mcp/vice matching .claude/mcp/vice's 3-segment depth) is plan 16-04's to verify."
  - "D-16-02: accepted losing in-repo skill autoload. Two real consumer routes documented in README.md instead: the npm installer (agent-runnable) and a local-marketplace plugin install (human-only, writes machine-global ~/.claude/plugins/ state)."
  - "scripts/package.sh's mustNotExist check ships now with only the skills entry, driven from one list constant plan 16-04 extends -- never a check that lands red."

requirements-completed: [PKG-01]

coverage:
  - id: D1
    description: "The six skills relocated to src/skills/, nothing left at the old auto-discovery location, and every functional source-tree consumer repointed"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "cd .claude/mcp/vice && VICE_REQUIRE_ACME=1 npm test"
        status: pass
      - kind: unit
        ref: "node scripts/check-skill-tool-coverage.mjs"
        status: pass
      - kind: unit
        ref: "node scripts/check-skill-fork-honesty.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/package.sh fails closed on a reappearing auto-discoverable skill payload, proven non-vacuous by a planted-and-removed directory"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "bash scripts/package.sh (planted .claude/skills/scratch -> exit 1; removed -> exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both real install routes (npm installer scratch-dir install, installer tarball dry-run) proven against the relocated skills tree without touching machine-global plugin state"
    requirement: "PKG-01"
    verification:
      - kind: integration
        ref: "node installer/bin/cli.mjs <scratch-dir>; npm pack --dry-run --json (installer)"
        status: pass
    human_judgment: false
  - id: D4
    description: "README.md documents the loss of in-repo autoload and the two consumer routes; acme-build/SKILL.md's source-tree path is current"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "grep checks against README.md and src/skills/acme-build/SKILL.md (see acceptance criteria)"
        status: pass
    human_judgment: false

duration: ~50min (estimated)
completed: 2026-08-22
status: complete
---

# Phase 16 Plan 01: Relocate the Six Skills to src/skills/ Summary

**Moved the plugin's smaller payload tree (six skills) out of Claude Code's auto-discovery path into `src/skills/` in one atomic `git mv`, repointed every functional consumer (manifest, packaging validator, two corpus-coverage CI gates, installer sync source, CI workflow, three vice-mcp test files, one sibling-scanning skill script), added a `mustNotExist` CI gate proving the old location can never silently reappear, and documented the resulting loss of in-repo autoload in README.md — all verified against the full 2292-test glob with zero regression from the pre-move baseline.**

## Performance

- **Duration:** ~50 min (estimated)
- **Started:** 2026-08-22T21:20:00Z (approx.)
- **Completed:** 2026-08-22T21:40:45Z
- **Tasks:** 3
- **Files modified:** 46 (32 renamed skill files + 1 file with content changes during the rename + 13 consumer files in Task 1; 1 file in Task 2; 2 files in Task 3)

## Accomplishments

- All six skills (`acme-build`, `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage`) live under `src/skills/`; `.claude/skills/` no longer exists.
- Every functional consumer repointed in the same commit as the move: `.claude-plugin/plugin.json`'s `skills` field, `scripts/package.sh`'s `skillsDir`, both skill-corpus CI checks' `SKILLS_DIR` (non-vacuity floors — ≥30 `vice_*`, ≥10 `anno_*`, ≥8 fork-only — left untouched), `installer/scripts/sync-skills.mjs`'s `SRC`, CI's two `acme.mjs` invocations, and three vice-mcp test files' `SKILLS_DIR`/`ACME_MJS`/scratch-file target.
- `recovery-schema.mjs`'s `SCAN_DIRS[1]` rebuilt `HERE`-relative (was project-root-relative and would have silently stopped resolving), with a new loud existence assertion on both scan directories.
- Found live, by the full test run, three functional literals the plan's own enumerated consumer set missed (`anno-regbits-gen.ts`'s `MEMMAP_PATH` and two scratch-tree mirrors of it, `stock-a4-checkpoint-flood.test.ts`'s `memmapPath`) — fixed for the new 3-level hop depth (see Deviations).
- `scripts/package.sh` gained a `mustNotExist` check that fails CI if `.claude/skills` reappears at the repo root, proven non-vacuous by a live plant-and-remove.
- Both real install routes (npm installer scratch-dir install; installer tarball dry-run) proven against the relocated tree in a scratch directory, never touching machine-global `~/.claude/plugins/` state.
- README.md now states the payload lives under `src/skills/`, is no longer auto-discovered, why that tradeoff was accepted, and the two consumer routes for exercising it.

## Task Commits

1. **Task 1: Capture the pre-move baseline, then move the six skills and update every functional consumer in one commit** - `2d8c25b` (feat)
2. **Task 2: Prove the packaging pipeline and the installer route against the relocated skills tree** - `fbf4448` (feat)
3. **Task 3: Record the dev-time story where a developer will actually hit it** - `e404ac6` (docs)

**Plan metadata:** (this SUMMARY + STATE.md/ROADMAP.md commit, made immediately after this file)

## Files Created/Modified

- `src/skills/**` (32 files, `git mv`d from `.claude/skills/`) - the six skill directories, byte-identical
- `.claude-plugin/plugin.json` - `skills` field now `./src/skills/`
- `scripts/package.sh` - `skillsDir` literal repointed; `mustNotExist` payload-absence check added
- `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-fork-honesty.mjs` - `SKILLS_DIR` and every failure-message/comment repointed; floors unchanged
- `installer/scripts/sync-skills.mjs` - `SRC` repointed
- `.github/workflows/ci.yml` - two `acme.mjs` invocations in the library-free scaffold step repointed
- `.claude/mcp/vice/anno-verb-coverage.test.ts`, `anno-symbol-roundtrip.test.ts`, `skill-honesty-checks.test.ts` - `SKILLS_DIR`/`ACME_MJS`/scratch-file target repointed
- `.claude/mcp/vice/anno-regbits-gen.ts`, `anno-regbits.test.ts`, `stock-a4-checkpoint-flood.test.ts` - `MEMMAP_PATH`/`memmapPath` literals rebuilt for the new 3-level hop depth (deviation, see below)
- `src/skills/c64-provenance-diff/scripts/recovery-schema.mjs` - `SCAN_DIRS[1]` rebuilt `HERE`-relative with an existence assertion
- `src/skills/c64-provenance-diff/scripts/diff-images.mjs` - added a one-line comment at the generation site recording the embedded consumer path is deliberate
- `README.md` - new "Developing this repo: no in-repo autoload" section
- `src/skills/acme-build/SKILL.md` - one source-tree path reference updated

## Decisions Made

- **D-16-01 (target layout):** `src/skills/` confirmed as the target, unconstrained for the skills half (recorded in the plan's own objective, reused here as-is — no new decision needed for this plan beyond executing it).
- **D-16-02 (dev-time story):** accepted losing in-repo skill autoload; documented the npm installer and local-marketplace-plugin routes in README.md, with the marketplace route explicitly marked human-only.
- **`mustNotExist` scoped to one entry now:** the check ships with only the skills payload directory; the MCP-server parent directory entry is deliberately deferred to plan 16-04's own commit, per the plan's explicit instruction not to land a red check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three functional path literals outside the plan's own enumerated consumer set broke 4 tests after the move**
- **Found during:** Task 1, running the full `VICE_REQUIRE_ACME=1 npm test` glob (first post-move run: 2244 pass / 4 fail, down from the 2248-pass baseline)
- **Issue:** `anno-regbits-gen.ts:57`'s `MEMMAP_PATH` was built as `join(HERE, "..", "..", "skills", "c64-memory-mapping", "memmap.json")` — a 2-level-up hop that resolved to `.claude/skills/...` when `.claude/skills` existed, but no longer resolves now that the skills tree is `src/skills/` (3 levels up from `.claude/mcp/vice`, since `src/` sits directly under the repo root rather than under `.claude/`). `anno-regbits.test.ts` carried two scratch-tree tests that mirror this generator's own relative-path formula in a synthetic `tmpDir` (to prove the drift guard and the non-vacuity throw), and `stock-a4-checkpoint-flood.test.ts:128` had an identical literal for reading the KERNAL IRQ default address out of `memmap.json`. None of these four sites were in the plan's own `read_first`/consumer-edit list.
- **Fix:** Rebuilt all four literals for the 3-level hop (`join(HERE, "..", "..", "..", "src", "skills", ...)`). For the two scratch-tree tests in `anno-regbits.test.ts`, restructured the synthetic `tmpDir` layout to mirror the real repo shape 3 levels deep (`tmpDir/claude/mcp/vice` alongside `tmpDir/src/skills/c64-memory-mapping`, matching `.claude/mcp/vice` and `src/skills/...` both sitting directly under the repo root) so the generator's own `HERE`-relative formula resolves identically inside the scratch tree.
- **Files modified:** `.claude/mcp/vice/anno-regbits-gen.ts`, `.claude/mcp/vice/anno-regbits.test.ts`, `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`
- **Verification:** Re-ran `VICE_REQUIRE_ACME=1 npm test` — 2292 tests, 2248 pass, 0 fail, 39 skipped, 5 todo, 23 suites — exactly matching the pre-move baseline.
- **Committed in:** `2d8c25b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** The fix was essential — without it the plan's own gate (full test glob, 0 fail) would not pass. No scope creep: all three sites are the same class of literal the plan's key_links already flagged as the trap for this whole plan ("some literals name where the skills live in this repository... others name where they live once installed"), just three instances the plan's own enumeration missed. Confirms the plan's own stated purpose for being a tracer: catching gaps in the relocation machinery on six directories before the much larger vice-mcp move.

## Issues Encountered

None beyond the deviation above. The `npm test` run intermittently exceeded the 120s foreground command timeout (observed once at ~222s and once needing a background wait to reach ~118s) — not a functional issue, just wall-clock variance on this host; handled by backgrounding and polling for the completion marker rather than retrying.

## Evidence (verbatim, per this plan's `<output>` spec)

### Pre-move `npm test` counter block (baseline, before any edit)

```
# tests 2292
# suites 23
# pass 2248
# fail 0
# cancelled 0
# skipped 39
# todo 5
# duration_ms 95506.12509
```

### Post-move `npm test` counter block (final, Task 1, after the deviation fix)

```
# tests 2292
# suites 23
# pass 2248
# fail 0
# cancelled 0
# skipped 39
# todo 5
# duration_ms 118021.81231
```

### Sorted 73-entry `npm pack --dry-run --json` path list (vice-mcp package, for plan 16-04 to compare against)

```
README.md
THIRD-PARTY-NOTICES.md
backend-detect.mts
build.ts
capability-registry.ts
container-guard.mts
containerpath.ts
disasm-decoder.ts
disasm-opcodes.ts
disasm-renderer.ts
hostpath.ts
incident-record.ts
install-resources.ts
package.json
anno-acme-ident.ts
anno-cli.ts
anno-confidence.ts
anno-d64.ts
anno-enum-gen.ts
anno-launch.ts
anno-mcp-client.ts
anno-memmap-render.ts
anno-project.ts
anno-regbits-gen.ts
anno-regbits.json
anno-symbols.ts
anno-tools.ts
anno-verify.ts
refresh-manifest.ts
repo-root.ts
resources/backend-detect.mjs
resources/broker-control.mjs
resources/broker-epoch.mjs
resources/broker-kill.mjs
resources/broker-launch.mjs
resources/broker-state.mjs
resources/container-guard.mjs
resources/vice-broker.mjs
resources/vice-launcher.sh
stock-address.ts
stock-checkpoints.ts
stock-cia.ts
stock-condition.ts
stock-connect.ts
stock-derived.ts
stock-diagnose.ts
stock-disassemble.ts
stock-dispatch.ts
stock-execution.ts
stock-handler.ts
stock-input.ts
stock-machine.ts
stock-memory-search.ts
stock-memory.ts
stock-paths.ts
stock-petscii.ts
stock-protocol.ts
stock-recycle.ts
stock-registers.ts
stock-run-until.ts
stock-runstate.ts
stock-sprites.ts
stock-symbols.ts
stock-timing.ts
stock-vicii.ts
tools-manifest.json
tools-manifest.stock.json
version.ts
vice-broker-client.ts
vice-probe.ts
vice-proxy.ts
vice-sync.ts
vice.ts
```
(73 entries; matches the plan's own pre-recorded count exactly.)

### The planted-directory failure output from `scripts/package.sh`, and the green re-run (Task 2)

Planted:
```
$ mkdir -p .claude/skills/scratch
$ bash scripts/package.sh; echo "exit=$?"
package: validating plugin manifests and layout ...
package: manifest/layout validation failed:
  - .claude/skills exists at the repository root -- the payload must activate only when installed, not by repo-root auto-discovery
exit=1
```

Removed and re-run:
```
$ rmdir .claude/skills/scratch .claude/skills
$ bash scripts/package.sh; echo "exit=$?"
package: validating plugin manifests and layout ...
package: manifests OK (plugin "c64-re-tools" v0.0.0-dev)
package: building /home/henrik/dev/henrik/git/c64-re-tools/dist/c64-re-tools-0.0.0-dev.zip from tracked files at HEAD ...
package: done:
  artifact : /home/henrik/dev/henrik/git/c64-re-tools/dist/c64-re-tools-0.0.0-dev.zip
  files    : 955
  sha256   : 9ff5855229d0227cfc33e93cf300b79b45a5c7b568df98817217f08fbf496ea4
exit=0
```
`git status --porcelain` showed no `installer/skills/` or scratch artifact afterward.

### The scratch project's `.mcp.json` before and after the installer run (Task 2)

Before (pre-seeded with an unrelated server):
```json
{
  "mcpServers": {
    "unrelated-server": {
      "command": "npx",
      "args": ["-y", "some-other-tool"]
    }
  }
}
```

After `node installer/bin/cli.mjs <scratch-dir>`:
```json
{
  "mcpServers": {
    "unrelated-server": {
      "command": "npx",
      "args": [
        "-y",
        "some-other-tool"
      ]
    },
    "vice": {
      "command": "npx",
      "args": [
        "-y",
        "@henols/vice-mcp@latest"
      ],
      "timeout": 150000,
      "env": {
        "MASTRA_TELEMETRY_DISABLED": "1"
      }
    }
  }
}
```
(The installer fell back to `@henols/vice-mcp@latest` rather than a pinned version, since this dev checkout's `installer/package.json` pins the `0.0.0-dev` placeholder — an expected, self-reported warning, not a defect this plan introduced.) The scratch directory carried all six skills under `<scratch-dir>/.claude/skills/`, and was removed after the check (`test ! -d <scratch-dir>` confirmed; `git status --porcelain` showed no stray artifact in this repository).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/skills/` is the proven, gate-verified target layout for the skills half of the packaging move; plan 16-04 (the much larger `.claude/mcp/vice/` → `src/mcp/vice/` move) can proceed with confidence in the relocation machinery — the same manifest path, packaging validator, corpus-coverage gates, installer sync, and CI harness pattern all held up under this smaller move, including catching a real gap (the `MEMMAP_PATH` family) the plan's own consumer enumeration missed.
- `scripts/package.sh`'s `mustNotExist` check is in place with the skills entry; plan 16-04 adds the second entry (the relocated MCP-server parent directory) to the same list constant.
- No blockers for 16-02 through 16-07.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-22*

## Self-Check: PASSED

- FOUND: `src/skills/acme-build/SKILL.md`
- FOUND: `src/skills/c64-provenance-diff/scripts/recovery-schema.mjs`
- FOUND commit `2d8c25b` in git history
- FOUND commit `fbf4448` in git history
- FOUND commit `e404ac6` in git history
- All acceptance criteria and plan-level `<verification>` commands re-run live in this session; results recorded above (Evidence section) and inline during execution. No missing items.
