---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 04
subsystem: infra
tags: [regenerator2000, cli, argv-subcommand, node-test, bootstrap, d64, acme]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "r2000-launch.ts (10-01), r2000-project.ts (10-02), r2000-d64.ts (10-03) -- the guarded seam, the synthesiser, and the .d64 extractor this plan wires together"
provides:
  - "r2000-cli.ts: the `bootstrap` and `export-asm` verbs, composing all three seam modules from plans 10-01/10-02/10-03"
  - "vice-proxy.ts's `r2000` argv subcommand -- the one bin surface that resolves identically across the Claude Code plugin route and both npm-installer routes"
  - "package.json's files[] now ships all four r2000-*.ts modules, closing the gap plan 10-01 deliberately left open"
  - "End-to-end proof, against the real published bin, that the subcommand short-circuits before the MCP server starts (RESEARCH.md Open Question #1 / Assumption A2, previously unverified)"
affects: ["10-05", "10-06 (SKILL.md pointers quote this plan's invocation string verbatim)", "phase-11-r2000-mcp-surface"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "argv subcommand on an existing published bin, dispatched via a dynamic import as the first executable statement of the module body -- resolves identically across the plugin route and both npm-installer routes, unlike a filesystem-path-resolving design or a second bin entry"
    - "CLI functions return an exit code and never call process.exit() themselves -- only the bin's own dispatch branch does, so the CLI is testable in-process as well as from a real spawn"
    - "console.log/console.error capture-and-restore for in-process CLI testing, avoiding a child-process spawn per test case"

key-files:
  created:
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts
  modified:
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "Adopted RESEARCH.md's Open Question #1 recommendation as-is: an argv subcommand on the existing `vice-mcp` bin, not a second bin entry -- installer/bin/cli.mjs's viceServerEntry() always launches via npx in both npm-installer modes, so a filesystem-path design would silently fail to resolve for npm-installed users"
  - "The r2000 dispatch is the first executable statement after the import block (before HERE_DIR, before ACTIVE_BACKEND's backend probe) -- a CLI invocation never opens a socket, never probes a binary, never writes JSON-RPC to stdout"
  - "process.exit() in vice-proxy.ts's dispatch branch is deliberate and explicitly does not violate the file's teardown-handler process.exit() prohibition: that rule protects the long-lived server's lease-release path, and this branch exits before any lease, socket or handler exists"
  - "export-asm bootstraps a bare input to a temp project first (cleaned up in a finally), so a bare .prg becomes ACME source in one command with no separate bootstrap step required from the caller"
  - "Reworded two header-comment sentences in r2000-cli.ts to avoid literal 'process.exit' substring collisions with the task's own acceptance-criteria grep -- same grep-gate hygiene issue plan 10-01 documented"

requirements-completed: [R2000-09, R2000-02]

# Metrics
duration: ~35min
completed: 2026-08-20
---

# Phase 10 Plan 04: Wiring the r2000 CLI seam Summary

**`vice-mcp r2000 <verb>` is now a real, tested argv subcommand reaching a guarded bootstrap/export-asm CLI before any MCP server side effect runs -- verified end to end against the actual published bin, closing RESEARCH.md's previously-unverified Assumption A2.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-20 (after worktree base correction to `faaca47`)
- **Completed:** 2026-08-20T15:56:22Z
- **Tasks:** 3/3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Built `r2000-cli.ts`: `runR2000Cli(argv)` composes `r2000-launch.ts`, `r2000-project.ts` and `r2000-d64.ts` into two verbs (`bootstrap`, `export-asm`), returns an exit code, and never calls `process.exit()` itself.
- `bootstrap` dispatches by extension and content check: `.prg`/other via `parsePrg()`, a `.d64` via `assertPlainImage()` + `extractEntry()` + `parsePrg()` on the extracted bytes, and an exactly-65536-byte flat capture via `flatImageOrigin()`. A `.d64` with no `--entry` prints the directory listing and returns exit code 2, never guessing (D-02); a `.vsf` input is refused with a message naming Phase 11 as its home (D-03).
- `export-asm` accepts a `.regen2000proj` directly or bootstraps a bare input to a temp project first (cleaned up in a `finally`), then calls `buildExportAsmArgs()`/`runR2000()` -- one command, no human interaction, raw binary to ACME source.
- Wired `vice-proxy.ts`: `process.argv[2] === "r2000"` short-circuits via a dynamic `import("./r2000-cli.ts")`, as the first executable statement after the import block -- strictly above `ACTIVE_BACKEND`'s backend probe, the manifest read, and `new MCPServer(...)`/`server.startStdio()`.
- Added `r2000-launch.ts`, `r2000-project.ts`, `r2000-d64.ts` and `r2000-cli.ts` to `package.json`'s `files[]`, closing the gap plan 10-01 deliberately left open.
- Proved the subcommand mechanism end to end against the real bin (not assumed): `node vice-proxy.ts r2000 --help` exits 0, prints both invocation forms, and emits **no line that parses as a JSON-RPC frame** -- the exact thing RESEARCH.md flagged as unverified for Assumption A2. `node vice-proxy.ts r2000 no-such-verb` exits non-zero with a usage block. Both terminate on their own within the spawn timeout (`signal === null`), ruling out a dispatch that falls through into `startStdio()` (which never returns).
- 9 tests in `r2000-cli.test.ts`, all passing on this host (regenerator2000 0.9.20 installed): 3 bin-level, 4 in-process verb tests (`.d64` no-entry listing + no write, `.d64` unknown-entry + no write, `.vsf` refusal + no write, `.prg` bootstrap with forced settings), the D-11 availability gate, and the gated end-to-end `export-asm` test producing real ACME source containing the illegal-opcode mnemonic `lax`.
- Confirmed the `R2000_BIN=definitely-not-installed-r2000` override path: 8 pass, the gated test SKIPs with a named reason, exit code 0 -- matching the acceptance criterion exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: r2000-cli.ts -- the two verbs, the usage text, and D-02's fail-loud listing** - `c85831e` (feat)
2. **Task 2: dispatch `r2000` from the vice-mcp bin, before any server side effect, and declare the new modules in files[]** - `3b18f7f` (feat)
3. **Task 3: r2000-cli.test.ts -- prove the subcommand short-circuits, the verbs work, and the .d64 refusal is real** - `78aa4fa` (test)

**Plan metadata:** committed as part of this SUMMARY (STATE.md/ROADMAP.md are NOT touched by this worktree agent, per orchestrator instructions).

## Files Created/Modified

- `.claude/mcp/vice/r2000-cli.ts` - the `bootstrap`/`export-asm` verb dispatcher; no `hostpath.ts`/`containerpath.ts` import, no direct `spawnSync`/`spawn`, no `process.exit` -- every child-process spawn goes through `r2000-launch.ts`'s `runR2000()`
- `.claude/mcp/vice/r2000-cli.test.ts` - 9 `node:test` cases: 3 bin-level (real bin spawn, `--help`/unknown-verb/no-hang), 4 in-process verb tests, the D-11 availability gate, and 1 gated end-to-end export test
- `.claude/mcp/vice/vice-proxy.ts` - the `r2000` argv short-circuit, inserted as the first executable statement after the import block, strictly above the backend probe and server construction
- `.claude/mcp/vice/package.json` - `files[]` now lists `r2000-launch.ts`, `r2000-project.ts`, `r2000-d64.ts`, `r2000-cli.ts`

## Decisions Made

- Followed the plan's adopted design exactly: an argv subcommand on the existing `vice-mcp` bin (RESEARCH.md Open Question #1's recommendation), not a second `bin` entry.
- Kept the CLI's option surface deliberately closed: exactly `--entry` and `--out`, both consumed by this file and never forwarded to the regenerator2000 child process argv (D-07).
- `export-asm`'s temp-project path is created via `mkdtempSync` and removed in a `finally`, so a crash mid-export never leaks a temp directory silently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1-adjacent — grep-gate hygiene] Reworded two header-comment sentences in `r2000-cli.ts` to avoid literal `process.exit` substring collisions**
- **Found during:** Task 1, immediately after writing `r2000-cli.ts` and running its own acceptance-criteria greps.
- **Issue:** The header comment and `runR2000Cli()`'s doc comment used the literal string `process.exit()` twice and once respectively to describe what the function does NOT do. The plan's own acceptance criterion runs a raw (non-comment-stripped) `grep -c 'process.exit' r2000-cli.ts` expecting 0, so the explanatory prose tripped the gate it was documenting -- the same class of issue plan 10-01's SUMMARY documented for `r2000-launch.ts`.
- **Fix:** Reworded to "never terminates the process itself" / "ends the process with this function's return value" / "exit the process directly" -- same meaning, no literal substring collision.
- **Files modified:** `.claude/mcp/vice/r2000-cli.ts` (part of Task 1, before its commit)
- **Verification:** `grep -c 'process.exit' r2000-cli.ts` returns 0; `npm run typecheck` exits 0; all other Task 1 acceptance-criteria greps return their expected counts.
- **Committed in:** `c85831e` (Task 1 commit -- corrected before the file's one commit, not as a separate fix-up)

---

**Total deviations:** 1 auto-fixed (grep-gate hygiene, self-contained within Task 1's single commit -- no separate fix-up commit needed).
**Impact on plan:** Required to make the plan's own specified acceptance criteria pass at all; no scope creep, no behavior beyond what the plan specified.

## Issues Encountered

- `npm ci` had not yet been run in this worktree (fresh checkout); ran it once at the start of Task 1 -- 237 packages installed, no changes to `package.json`/`package-lock.json`.
- A live interactive check of `node vice-proxy.ts r2000 --help` **without** `VICE_SKIP_RESOURCE_INSTALL=1` set printed the pre-existing `vice-mcp-selector: deployed host launcher scripts to ...` banner before the usage text. This is `repo-root.ts`'s own documented, pre-existing module-import-time side effect (`ensureResourcesInstalled()`, fired once per process on whatever entry point imports `repo-root.ts` -- a transitive import that executes before ANY of `vice-proxy.ts`'s own top-level statements run, per ES module semantics, so no placement of the `r2000` dispatch inside `vice-proxy.ts`'s own body can prevent it). It is orthogonal to this plan's own scope (it is not a socket open, not a binary probe, not a JSON-RPC write) and is already suppressed by `VICE_SKIP_RESOURCE_INSTALL=1`, exactly the convention `smoke.mjs` and this plan's own Task 3 (`r2000-cli.test.ts`'s `CLI_ENV`) already use. Confirmed clean output (usage text only, no banner) with that env var set, matching the load-bearing "no JSON-RPC frame" assertion's actual test conditions.
- Full `npm test` (1914 tests, ~2.5 min) surfaced exactly one failure unrelated to this plan's files: `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test, reproducible in isolation (`node --test repo-root.test.ts`). This is the same worktree-path artifact documented in plans 10-01/10-02/10-03's own summaries -- the worktree's own checkout path sits under `.claude/worktrees/agent-.../`, which the test's own "must not be under `.claude`" assertion structurally cannot pass from inside a GSD worktree. Neither `r2000-cli.ts` nor `vice-proxy.ts`'s new dispatch touches `repo-root.ts`. Per the scope boundary rule, left alone and recorded here rather than fixed.

## Verification

1. `cd .claude/mcp/vice && npm test` -- 1878 pass / 1 fail (known worktree artifact, see above) / 30 skip / 5 todo, no hang.
2. `cd .claude/mcp/vice && npm run smoke` -- OK, the MCP handshake path is unaffected (61 tools advertised).
3. `node scripts/check-npm-packages.mjs` (run from repo root) -- OK, transitive closure clean (43 modules), both tarballs pass.
4. `cd .claude/mcp/vice && npm run typecheck` -- exits 0.
5. **The exact invocation string plan 10-06's SKILL.md pointers must quote verbatim:** `npx -y @henols/vice-mcp r2000 export-asm game.prg`

## User Setup Required

None. `regenerator2000` (0.9.20) and `acme` were already installed on this host from Phase 9/plan 10-02's environment recheck.

## Next Phase Readiness

- `vice-mcp r2000 bootstrap`/`export-asm` are live, tested end to end against the real published bin, and ready for plan 10-05 (whatever consumes the CLI next) and plan 10-06 (SKILL.md pointers, which should quote the exact invocation string recorded above).
- `check-npm-packages.mjs` passes with all four r2000 modules declared in `files[]` -- a real `npm pack` of `@henols/vice-mcp` now ships the complete seam.
- No blockers.

---
*Phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal*
*Plan: 04*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/r2000-cli.ts`
- FOUND: `.claude/mcp/vice/r2000-cli.test.ts`
- FOUND: `.claude/mcp/vice/vice-proxy.ts` (modified, r2000 dispatch present)
- FOUND: `.claude/mcp/vice/package.json` (modified, files[] includes all four r2000 modules)
- FOUND commit `c85831e` (feat: r2000-cli.ts)
- FOUND commit `3b18f7f` (feat: dispatch + files[])
- FOUND commit `78aa4fa` (test: r2000-cli.test.ts)
