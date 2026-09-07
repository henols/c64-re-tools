---
created: 2026-09-07T09:46:41.197Z
title: Move all tests into a separate test folder
area: testing
severity: minor
files:
  - src/mcp/vice/*.test.ts (154 test files, colocated)
  - src/mcp/vice/package.json:122 (test script glob `node --test '*.test.*'`)
  - src/mcp/vice/test-gate.mjs:122-133 (MANUAL_ONLY_TESTS, bare basenames)
  - src/mcp/vice/ci-suite-coverage.test.ts:84-167 (suite-directory walk + SKILLS_GLOB_PROOF)
  - scripts/check-npm-packages.mjs:95-102 (test-file/fixture tarball leak checks)
  - src/mcp/vice/tsconfig.json
  - CLAUDE.md (Conventions: "Test files are colocated ... next to the module under test")
  - installer/wire-mcp.test.mjs, src/skills/*/scripts/*.test.mjs (9 more, outside src/mcp/vice)
---

## Problem

Every test in this repo sits next to the module it tests. `src/mcp/vice/` alone holds
**154** `*.test.ts` / `*.test.mts` / `*.test.mjs` files interleaved with ~150 source
modules, which makes the directory listing nearly unreadable and makes it hard to see
the actual shipped surface at a glance. Nine more test files live under
`installer/` and `src/skills/*/scripts/`.

The ask: move them into a dedicated test folder (e.g. `src/mcp/vice/tests/`, or a
top-level `tests/`).

This is a tidy-up, not a defect — the suite works today. The reason it is captured
rather than done inline is the blast radius:

1. **482 relative import lines** across the `src/mcp/vice/*.test.ts` files reference
   siblings as `./module.ts`. All become `../module.ts` (or need a path alias — but
   the project has *no* `tsconfig` `paths` remapping by convention, and every import
   must carry its real `.ts`/`.mts` extension because the shipped server runs under
   Node type-stripping with no build step).
2. **The test runner glob is cwd-only.** `package.json:122` is
   `node --test '*.test.*'`, which matches only the current directory — moving the
   files silently runs *zero* tests unless the glob is updated in lockstep.
3. **`test-gate.mjs` keys off bare basenames** (`MANUAL_ONLY_TESTS`, 12+ entries with a
   drift guard in `test-gate.test.ts`). Its own comments say a test may appear in that
   list and nowhere else.
4. **`ci-suite-coverage.test.ts` walks the tree** for suite directories and pins
   `SKILLS_GLOB_PROOF = "src/skills/*/scripts/*.test.mjs"`. A new layout changes what
   the walk finds. (Known trap: it also descends into `.claude/worktrees/agent-*/`, so
   measure after wave cleanup, not during.)
5. **`scripts/check-npm-packages.mjs:95-102`** asserts no `*.test.*` and no
   `fixtures/` leak into either published tarball; `package.json`'s `files` array is a
   hand-maintained allowlist that must keep excluding the new directory.
6. **`CLAUDE.md` Conventions** documents colocation as the standing rule
   ("Test files are colocated `*.test.ts` / `*.test.mts` next to the module under
   test") — the convention has to change with the layout, or the docs lie.
7. Fixture assets live at `src/mcp/vice/fixtures/`; tests that read them by relative
   path move too.

Get any one of 1–5 wrong and the suite goes green while running nothing, which is the
worst possible failure mode for this change.

## Solution

TBD — sketch, not a commitment:

- Decide scope first: `src/mcp/vice/` only, or repo-wide including `installer/` and
  `src/skills/*/scripts/`? The skills tests are shipped-package-adjacent and have
  their own glob proof, so they may be worth leaving alone.
- Do the move with `git mv` in one commit so history follows, then rewrite imports
  mechanically (`./` → `../` for the 482 lines) and verify by count, not by eye.
- Update, in the same change: the `test` script glob, `test:automated`/`test-gate.mjs`
  path resolution, `ci-suite-coverage.test.ts`'s walk, `check-npm-packages.mjs`, the
  `files` allowlist, and the CLAUDE.md convention bullet.
- **Verification gate:** before/after test *counts* must match. The automated floor is
  documented as 2-in-1 failing (one named bookkeeping cause) as of 2026-09-03 — measure
  it before starting and compare, and stop the VICE broker first, since a live broker
  deterministically reds the BACK-05 test. Do not accept "0 failures" as proof; a
  broken glob also reports 0.
- Consider whether a flat `tests/` folder loses the module↔test adjacency that makes
  the current layout easy to navigate from the source side; a per-area subfolder
  (`tests/anno/`, `tests/broker/`, `tests/stock/`) may read better given 154 files.
