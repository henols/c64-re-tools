---
title: build-atomic.test.ts's cleanup assertion races other build() callers on the shared system /tmp
date: 2026-08-22
priority: low
source: /gsd-execute-phase 12 — regression gate, run 1 of 2
---

# One full-suite run in two goes red on a test-isolation bug, not a real defect

`build-atomic.test.ts:184` — *"the private temp directory is cleaned up on both the
success and the failure path, leaving no sibling of the out-dir behind"* — failed in
one full-suite run and passed in the next, with no code change between them.

## Cause

The test's `tempSiblingsOf()` helper (`build-atomic.test.ts:186-189`) lists
`dirname(outDir)` and filters for `.build-tmp-`. Its `outDir` comes from
`mkdtempSync(join(tmpdir(), …))`, so `dirname(outDir)` **is the shared system
`/tmp`** — not a private parent. The assertion therefore fails if *any* other
process has a `.build-tmp-*` directory in `/tmp` at that instant.

`node --test '*.test.*'` runs test *files* concurrently, and ten other files call
`build()`: `resources-sync.test.ts`, `broker-*.test.ts`, `vice-broker-*.test.ts`,
`stock-*-live*.test.ts`. Any of them staging a `.build-tmp-` in `/tmp` while
`build-atomic.test.ts` is between its `build()` call and its `readdirSync` reddens
the assertion. Run the file alone and it is 6/6 green, every time.

## Evidence

- Full suite run 1: `# tests 2262 / # pass 2226 / # fail 1` — `not ok 304`, this test.
- Full suite run 2, no changes: `# tests 2262 / # pass 2227 / # fail 0`.
- `node --test build-atomic.test.ts` alone: `# tests 6 / # pass 6 / # fail 0`.
- `ls -d /tmp/.build-tmp-*` between runs: nothing left behind — the staging dirs
  *are* cleaned up, which is the very thing the test is trying to prove.

## Not a phase-12 regression

`build-atomic.test.ts` has one commit in its history, `b0975f4` (the initial plugin
import), and is untouched by any GSD phase. Phase 12 modified only
`scripts/audit-gate.mjs`, `.claude/mcp/vice/audit-integrity.test.ts`,
`.claude/settings.json`, `.gitignore` and planning documents. The flake is
pre-existing and orthogonal.

It also does not reach `audit-gate.mjs`: the gate spawns only the four
`docs-*.test.ts` guards, never the full suite, so a red `build-atomic` cannot make
the milestone-audit gate misfire in either direction.

## Fix shape

Stage the out-dir under a private parent so the sibling scan is scoped to this
test's own directory rather than to all of `/tmp` — e.g. `mkdtempSync` a wrapper
directory first and create `successOut` / `failOut` *inside* it, leaving
`dirname(outDir)` private. That preserves exactly what the test is asserting (no
`.build-tmp-` survives next to the out-dir) while making it immune to every other
concurrent `build()` caller.

## Resolution

**Fixed.** Commit `7484afa`, Phase 15 plan 15-07 Task 1.

`successOut` and `failOut` now live inside one private `mkdtempSync()` wrapper
directory (`build-atomic-cleanup-wrapper-*`) instead of directly under
`os.tmpdir()`, so `tempSiblingsOf()`'s scan of `dirname(dir)` is scoped to a
parent this test run owns exclusively. The assertion's meaning is unchanged —
no `.build-tmp-*` staging directory may survive next to the out-dir — it is
just no longer sensitive to any other process's temp usage.

The ten-file `build()` concurrency surface this fix immunises against, confirmed
by `grep -rl "from \"./build.ts\"" *.test.ts` in `.claude/mcp/vice` (all callers
of the same `build()` entry point, `build-atomic.test.ts` itself excluded):
`broker-control.test.ts`, `broker-e2e.test.ts`, `broker-kill.test.ts`,
`broker-launch.test.ts` (import only, no direct call), `resources-sync.test.ts`
(the sharpest collision risk — its own `scratchDir` is
`mkdtempSync(join(tmpdir(), "resources-sync-"))`, landing in the exact same
shared parent this test used to scan), `stock-broker-live.test.ts`,
`stock-live-broker-monitor.test.ts`, `vice-broker-acquire.test.ts`,
`vice-broker-launch.test.ts` (import only, no direct call),
`vice-broker-supervision.test.ts`.

**Proven by a planted violation, not a single green run**, exactly as this
todo's own evidence style requires:

- Pre-fix: `mkdir -p /tmp/.build-tmp-planted-probe-12345 && node --test
  build-atomic.test.ts` — the cleanup test failed with `+
  ['.build-tmp-planted-probe-12345']` where `[]` was expected. Removed the
  planted directory afterward.
- Post-fix: same planted directory in `/tmp`, same command — the cleanup test
  passed; the wrapper's private parent no longer overlaps `/tmp`.

**Re-verified, not assumed:**
- `cd .claude/mcp/vice && npm run typecheck` — exit 0.
- `node --test build-atomic.test.ts`, three consecutive runs — 6/6 pass every
  time.
- `npm run test:automated`, two consecutive runs — `2110 tests / 2105 pass / 0
  fail / 5 pre-existing todo`, identical both times (matches the pre-existing
  baseline recorded in `15-06-SUMMARY.md`'s Self-Check).

The flake was pre-existing (`build-atomic.test.ts`'s only prior commit is
`b0975f4`) and was never reachable from `audit-gate.mjs` (which spawns only the
four `docs-*.test.ts` guards, never the full suite) — no milestone-audit
verdict was ever affected by it.
