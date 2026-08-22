---
phase: 16-packaging-and-repo-shape
plan: 03
subsystem: packaging
tags: [installer, node-test, mcp-json, testing, regression-coverage]

# Dependency graph
requires: []
provides:
  - "installer/wire-mcp.test.mjs: 18 node:test cases pinning wireMcp()'s nine happy-path merge behaviours and six malformed-config refusal shapes (seven test cases) against the shipped installer/bin/cli.mjs"
  - "installer/bin/cli.mjs: entry-point dispatch guard (driver.mjs idiom) plus wireMcp/readJson exports, behaviour-invisible to a real npx invocation"
  - "installer/package.json: a working `npm test` script (node --test), zero new dependencies or devDependencies"
affects: [16-04, 16-05]

# Actuals (#2632)
actuals:
  tokens: 4224
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entry-point dispatch guard (process.argv[1] vs import.meta.url) to make a CLI module's internals importable by a test without triggering the CLI's own execution -- same idiom as src/skills/c64-memory-mapping/scripts/driver.mjs"
    - "Refusal-path testing via a real subprocess (spawnSync(process.execPath, [\"--input-type=module\", \"-e\", script])) when the function under test calls process.exit() itself, rather than mocking process.exit"

key-files:
  created:
    - installer/wire-mcp.test.mjs
  modified:
    - installer/bin/cli.mjs
    - installer/package.json

key-decisions:
  - "D-16-03(a): the plugin install route needs no new merge code -- it declares MCP servers through a manifest pointer, not a file rewrite. The file-writing merge is the npm-installer route only, and wireMcp() already implements it correctly."
  - "D-16-03(b): built the installer regression test even though PKG-01's headline success criterion speaks only of tarball contents, because the pending todo's own Solution step 4 named this test explicitly and the phase's security research names a malformed consumer config as a tampering path whose only mitigation is wireMcp()'s refuse-on-invalid branch -- an unasserted mitigation is a claim, not a control."
  - "Chose the in-process export seam over a subprocess-only route for happy-path tests (wireMcp() never calls process.exit() on success), and reserved spawnSync-based subprocess tests specifically for the six malformed-config refusal cases, where wireMcp() calls process.exit(1) directly."

patterns-established:
  - "installer/ package now has a real node:test suite; future installer changes must run `cd installer && npm test` before merging."

requirements-completed: []  # PKG-01 is shared with 16-01/16-04/16-05; see requirements.ready-ids gate in the executor prose below

coverage:
  - id: D1
    description: "wireMcp()'s nine happy-path merge behaviours (absent config, unrelated servers/keys surviving byte-for-byte, {} and null/42 mcpServers coercion, keep/force on an existing vice entry, idempotence, dry-run no-writes) are pinned against the shipped cli.mjs"
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "installer/wire-mcp.test.mjs#(11 happy-path test cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six malformed consumer-config shapes (truncated JSON, zero-byte file, JSON array, JSON null, bare string, bare number, JSON-with-comments) are each proven refused: non-zero exit, file path named in the message, bytes unchanged, directory listing unchanged"
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "installer/wire-mcp.test.mjs#(seven refusal test cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The CLI's observable behaviour (--help output, no-target dry-run output, exit codes) is unchanged by the entry-point dispatch guard added for testability"
    verification:
      - kind: manual_procedural
        ref: "before/after comparison via git stash, documented verbatim below"
        status: pass
    human_judgment: false
  - id: D4
    description: "The test file does not ship in the installer tarball, no dependency or devDependency was added, and the sibling package/CI gates (check-npm-packages.mjs, package.sh, .claude/mcp/vice's own suite) are unaffected"
    verification:
      - kind: integration
        ref: "npm pack --dry-run --json; node scripts/check-npm-packages.mjs; bash scripts/package.sh; cd .claude/mcp/vice && VICE_REQUIRE_ACME=1 npm test"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-22
status: complete
---

# Phase 16 Plan 03: Installer Test Seam Summary

**`installer/`'s never-tested `wireMcp()` -- the one function in this repo that rewrites a file it doesn't own -- now has 18 `node:test` cases (11 happy-path, 7 refusal) driving the shipped `cli.mjs` directly, with zero new dependencies and zero duplicated merge logic.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-22T21:54:37Z (prior plan's close)
- **Completed:** 2026-08-22T22:03:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `installer/bin/cli.mjs` gained a behaviour-invisible entry-point dispatch guard (the same idiom `src/skills/c64-memory-mapping/scripts/driver.mjs` already uses) and exports `wireMcp`/`readJson`, so a test can drive the real merge logic without executing the CLI as a side effect of import.
- `installer/wire-mcp.test.mjs` pins all nine happy-path merge behaviours named in the plan (absent config + missing-parent-dir creation, unrelated servers/keys surviving byte-for-byte, `{}` and `mcpServers: null`/`42` coercion, keep-without-force, replace-with-force, idempotence, and dry-run no-writes for both the absent- and existing-file cases) as 11 discrete test cases, all in-process against the shipped module.
- Six malformed consumer-config shapes (truncated JSON, zero-byte file, JSON array root, JSON `null`, bare string, bare number, JSON-with-comments) are proven refused as seven test cases, each driven through a real subprocess (`spawnSync(process.execPath, ["--input-type=module", "-e", ...])`) since `wireMcp()`'s refusal path calls `process.exit(1)` directly, which would otherwise kill the in-process test runner. Each refusal case asserts three things: non-zero exit with the file path named in stderr, byte-identical file content before/after, and an unchanged scratch-directory entry list.
- `installer/package.json` gained a `test` script (`node --test '*.test.mjs'`) with zero new dependencies (`dependencies` count unchanged at 1, `devDependencies` count 0); `sync-skills`/`prepack` untouched and re-verified working.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stand up the installer test seam and pin the merge's happy paths** - `7e18ed5` (feat)
2. **Task 2: Pin the refusal paths — a malformed consumer config must be refused, never rewritten** - `75ad61e` (test)

_Note: Task 1 also carried the `installer/bin/cli.mjs` seam and `installer/package.json`'s `test` script; Task 2 only added test cases to the already-created `installer/wire-mcp.test.mjs`._

## Files Created/Modified
- `installer/wire-mcp.test.mjs` - New: 18 `node:test` cases (11 happy-path + 7 refusal) against the shipped `wireMcp()`/`readJson()`
- `installer/bin/cli.mjs` - Entry-point dispatch guard + `wireMcp`/`readJson` exports (13 lines changed, no behaviour change to a real invocation)
- `installer/package.json` - Added `"test": "node --test '*.test.mjs'"` script

## Seam Decision (per Task 1's action + this plan's `<output>` spec)

**Seam taken: in-process export, plus entry-point dispatch guard.** `cli.mjs` originally ran `main()` at module scope; a bare `import { wireMcp } from "./bin/cli.mjs"` would therefore have executed a real (attempted) install as a side effect. The guard added is:

```js
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
export { wireMcp, readJson };
```

This is the exact idiom already used by `src/skills/c64-memory-mapping/scripts/driver.mjs:536`. Happy-path tests call `wireMcp()` in-process (it only writes/returns on success). Refusal-path tests still go through a subprocess — not because the guard failed, but because `wireMcp()`'s own refusal branches call `process.exit(1)`, which an in-process call cannot survive inside the test runner. The subprocess imports `wireMcp` from the shipped file by absolute path (`spawnSync(process.execPath, ["--input-type=module", "-e", script])`) rather than a shell string, per the plan's discipline requirement.

### `--help` output, before vs. after (verbatim, via `git stash`)

Both captured from the real repo location (`node installer/bin/cli.mjs --help`), stashing the guard change to get the "before" run and restoring it for "after." Output is byte-identical:

```
c64-re-tools -- install the C64 reverse-engineering skills + VICE MCP server into a project

Usage:
  npx @henols/c64-re-tools [targetDir] [options]

Arguments:
  targetDir            Project to install into (default: current directory)

Options:
  --force              Overwrite existing skills and an existing 'vice' MCP entry
  --vendor             Also 'npm install -D @henols/vice-mcp' into the project and wire
                       .mcp.json to the local copy (pinned/offline), instead of npx
  --dry-run, -n        Show what would change without writing anything
  --help, -h           Show this help

What it does:
  1. Copies bundled skills into <target>/.claude/skills/
  2. Adds a 'vice' server to <target>/.mcp.json (other servers are preserved)

Requires Node >= 22.18 to RUN the vice MCP server (this installer runs on Node >= 18).
```

(The pre-existing "unstamped dev checkout" warning on stderr is unrelated to this plan -- it fires because this working tree's `installer/package.json` still pins the `0.0.0-dev` placeholder, identical before and after.) Exit code: `0` in both runs.

### No-target (dry-run into a scratch dir) output, before vs. after

Same before/after `git stash` method, run as `node installer/bin/cli.mjs <scratch-dir> --dry-run`:

```
c64-re-tools 0.0.0-dev -> <scratch-dir>  (dry run)

  skills  -> <scratch-dir>/.claude/skills
            6 installed, 0 already present (use --force to overwrite) of 6
            + acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, vice-wedge-triage
  mcp     -> <scratch-dir>/.mcp.json
            'vice' added (npx -y @henols/vice-mcp@latest)

Dry run -- nothing was written.
```

Byte-identical (modulo the scratch path itself) before and after the guard. Exit code: `0` in both runs.

### Test counts

- After Task 1: 11 tests, `# fail 0`.
- After Task 2: 18 tests, `# fail 0`.

### Installer tarball dry-run entry list (`cd installer && npm pack --dry-run --json`)

```
README.md
bin/cli.mjs
package.json
skills/acme-build/scripts/acme.mjs
skills/acme-build/SKILL.md
skills/acme-build/template.a
skills/c64-memory-mapping/memmap.json
skills/c64-memory-mapping/scripts/driver.mjs
skills/c64-memory-mapping/SKILL.md
skills/c64-program-recon/references/*.md (6 files)
skills/c64-program-recon/scripts/derive.mjs
skills/c64-program-recon/SKILL.md
skills/c64-program-recon/templates/memory-map.template.md
skills/c64-provenance-diff/scripts/diff-images.mjs
skills/c64-provenance-diff/scripts/diff-images.test.mjs
skills/c64-provenance-diff/scripts/recovery-schema.mjs
skills/c64-provenance-diff/SKILL.md
skills/c64-ram-capture/RELEASES.json.example
skills/c64-ram-capture/scripts/*.mjs (7 files, including 3 test files)
skills/c64-ram-capture/SKILL.md
skills/c64-ram-capture/templates/capture-record.template.md
skills/vice-wedge-triage/SKILL.md
```

36 entries total, all six `skills/<name>/SKILL.md` present, `bin/cli.mjs` present, `wire-mcp.test.mjs` **absent** (confirmed programmatically: `files.includes("wire-mcp.test.mjs") === false`) — matching `files[]`'s `bin/`, `skills/`, `README.md` declaration.

## Decisions Made

See `key-decisions` in frontmatter (D-16-03(a), D-16-03(b), and the in-process-plus-subprocess seam split).

## Deviations from Plan

None - plan executed exactly as written. The seam chosen (in-process export + dispatch guard, subprocess only for refusal cases) is the primary route the plan's Task 1 action anticipated, not the fallback.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `installer/` now has a working regression suite; any future change to `wireMcp()` or the merge semantics must keep `cd installer && npm test` green.
- `PKG-01` is shared across plans 16-01 (relocate skills, complete), 16-03 (this plan), 16-04 (relocate vice-mcp payload, not yet run), and 16-05 (not yet run). Per the shared-ID gate, `PKG-01` stays open in REQUIREMENTS.md until all four SUMMARYs exist — this plan's `update_requirements` step correctly leaves it unmarked rather than flipping it early.
- No blockers for 16-04/16-05: this plan's action and assertions are entirely scoped to `installer/`, confirmed independent of the vice-mcp payload's location (per `viceServerEntry()`'s lack of a repository path literal, verified again this session).

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-22*

## Self-Check: PASSED

- `installer/wire-mcp.test.mjs` — FOUND
- `installer/bin/cli.mjs` — FOUND
- `installer/package.json` — FOUND
- Commit `7e18ed5` (Task 1) — FOUND in `git log --oneline --all`
- Commit `75ad61e` (Task 2) — FOUND in `git log --oneline --all`
- `cd installer && npm test` — 18/18 pass, `# fail 0` (re-run at self-check time)
- `node scripts/check-npm-packages.mjs` and `bash scripts/package.sh` — both exit 0
- `git status --porcelain` — clean except pre-existing untracked GSD/plugin scaffolding present before this plan started
