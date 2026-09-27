# Remove the byte-identity determinism and sync tests

## Context

Owner decision 2026-09-13 (old Phase 54, never started, requirements never
written; now `agent-os/product/roadmap.md:166` "Remove byte-identical
assertions from the tests"): byte-identity checks are unproductive and go.
Scope settled today (2026-09-27):

- **Remove** determinism/idempotence checks (two runs, two calls or two
  parses of the same input compared with each other) and the tree-sync
  guards (a committed copy or build output compared with a fresh build of
  its source).
- **Keep** correctness checks where equal bytes is the product promise:
  ACME reassembly equals the original, a transfer equals what was sent, a
  refusal or read-only call left the file/store/state unchanged, a golden
  or single-source value, a security indistinguishability check, and a
  comparison tool reporting "identical" as its output.
- **Replace** the stale-build guards (`resources-sync`, `entry-sync`) with a
  CI step that regenerates every committed generated artifact and fails on
  a dirty tree.

PR #11 is merged. Work on a new branch from `origin/main`:
`remove-byte-identity-tests`.

## Classification calls made in the census (overrule at approval)

- **Regenerator agreement = sync guard → remove.** A committed `.prg`
  fixture compared with a fresh assembly of its `.a` is the same shape as
  `resources-sync`. The CI regeneration step covers it.
- **`anno-regbits.test.ts:51`** (fresh `buildRegBits()` deep-equals the
  committed JSON) = sync → remove (CI covers it). `:66` (banner twice) =
  determinism → remove. `:58` + `:72` (digest relation + its planted
  proof) are facts, not bytes → keep.
- **Keep:** non-vacuity preconditions ("the scratch copy equals its source
  before the mutation", e.g. `anno-memmap-render.test.ts:577/581/610`,
  `join-image-controls.test.ts:304`); `broker-relay.test.ts:454` (a second
  claim reuses the same handle: a contract); the "repeat write reports
  `changed:false`" rules; `build-atomic.test.ts:88` (atomicity);
  `vice-proxy.test.ts:821/1074` (unchunked path as reference).
- **Concurrency tests over synchronous functions** (`textmon-profile:295`,
  `textmon-registers:515`, `tool-location:503/705`) are repeated-call
  determinism → remove.
- **Rewrite instead of delete** where removing the comparison would leave
  a claim with no assertion:
  - `dxa-blocks.test.ts:146`: assert the second emit equals the literal
    `"1000-1fff\n4000-4fff\n"` (replace, never append).
  - `anno-export-asm.test.ts:4530` (`force: true` re-write): check the
    second tree's file set against the one the store's scopes define.
  - `anno-cli.test.ts:1797`: add `existsSync(join(chosen, ROOT_FILE_NAME))`
    so "--out overrides" keeps an explicit assert.
  - `ghidra-live.test.ts:472` GATE 3: drop the second run; keep the check
    that the fixture sha256 matches the README (nowhere else).

## Task 1: Spec and census (first commit, before any deletion)

Create `agent-os/specs/2026-09-27-1502-no-byte-identity-tests/` with
`plan.md` (this plan), `shape.md` (scope, owner decisions, the calls above,
what is knowingly given up), `standards.md`, `references.md`, and
`census.md`: the per-site table (file, line, class
S/T/A/K/C, test title, action). Re-run the census on the branch head:
`grep -a -n -i -E 'byte[- ]?identical|byte[- ]for[- ]byte|byte[- ]exact'`
over `src/mcp/vice/*.test.*` and `test/skills/**/*.test.ts` (use `-a`
because NUL bytes hide `prerequisites.test.ts` hits), plus the unlabelled
sites below. Record the baseline test counts in `census.md` (see Verification).
Commit before touching a test, so criterion "count drop reconciles" measures
a fixed tree.

Measured today: ~277 regex hits in 77 files plus ~31 unlabelled sites.
About 40 whole tests are deleted and about 26 are trimmed. About 124 hits
are K and about 105 are C (comment/title only, no change).

## Task 2: CI regenerate-and-diff step (before deleting the sync guards)

In `.github/workflows/ci.yml` job `build`, after the ACME install step and
before `Test`, add "Regenerate committed artifacts and fail on drift"
(`working-directory: src/mcp/vice`):

```
set -euo pipefail
find resources -name '*.mjs' -delete && rm -f vice-cli.mjs   # orphans show as deleted
node build.ts
node anno-regbits-gen.mts
node fixtures/hazard-subject/make-hazard-subject-fixtures.ts
node fixtures/export-asm/make-export-asm-fixtures.ts
git diff --exit-code -- .
test -z "$(git status --porcelain --untracked-files=all -- .)"
```

Deleting the `.mjs` files first catches stale, missing and orphan outputs.
That replaces `resources-sync`'s Direction 2, because `build()` does not
prune. Before you commit, run each generator locally on a clean tree and
confirm it leaves `git status` clean and needs no network. A generator that
dirties the tree is dropped from the step, and `shape.md` must say so. Also
find the generator behind `hazard-subject-exported-edit.test.ts:98`
(manifest + store → `.prg`) and add it if it passes the same check.
`--server`/`dist/` is gitignored and is not part of the step.

## Task 3: Remove the sync guards

- `src/mcp/vice/resources-sync.test.ts`: delete the `:50` test (both
  directions). Keep `:97` "no bare import specifier". Remove the dead
  imports (`build`, `mkdtempSync`, `rmSync`, `tmpdir`) and rewrite the header.
- `src/mcp/vice/entry-sync.test.ts`: delete the `:16` test. Keep `:36`
  (shebang + banner). Remove the dead imports and rewrite the header.
- `test/skills/sibling.test.ts:136`: delete the copies-identical and count
  test. Keep the 11+11 refuse/run tests and the recovery-schema gate test.
  Remove the `readFileSync` import and header line 8.
- Regenerator agreement: `hazard-subject-fixture.test.ts:576, :599`,
  `hazard-subject-variants.test.ts:229, :364` (delete the now-dead
  `assembleRegressedFreshWithSymbols`), `anno-export-asm.test.ts:1546`,
  and `hazard-subject-exported-edit.test.ts:103-105` (A: keep exit 0,
  `verdict.outcome`, `byte_diff.equal`). Edit the fixture file header
  (lines 17-20) that promises the cross-check.
- `anno-regbits.test.ts:51, :66`.

## Task 4: Remove determinism/idempotence tests (T) and assertions (A)

Pattern: a T test is deleted whole. For an A site, delete only the second
run/call and its assertion, retitle the test if its title names
determinism, and delete locals that become unused. The census lists every
site. Representative sites:

- **T** — `anno-export-asm.test.ts:504, 3386, 3735, 4593` (+ its
  non-vacuity twin `4617`); `anno-coverage.test.ts:801, 1090, 3821`;
  `anno-coverage-grammar.test.ts:1628`; `anno-import.test.ts:297`;
  `anno-memmap-render.test.ts:251`; `anno-store-export.test.ts:111`;
  `broker-endpoint.test.ts:397, 687`; `host-tool.test.ts:621`;
  `dxa-seam.test.ts:175`; `textmon-profile.test.ts:186, 288, 295`;
  `textmon-registers.test.ts:411, 508, 515`; `tool-location.test.ts:503, 705`;
  `hazard-subject-reassembly.test.ts:227, 233`;
  `skill-memory-map-derive-cli.test.ts:158`;
  `test/skills/c64-annotations/completeness-report.test.ts:211`;
  `test/skills/c64-provenance/diff-images.test.ts:513`.
- **A** — `anno-cli.test.ts:1815-1816`; `anno-confinement.test.ts:483`;
  `anno-coverage-grammar.test.ts:2152-2157`; `anno-coverage.test.ts:4076-4078`
  (keep the sha256 read-only check at 4079); `anno-export-asm.test.ts:3659, 4662`;
  `anno-import.test.ts:365, 508`; `anno-join.test.ts:91, 213, 490`;
  `anno-memmap-render.test.ts:714`; `ghidra-live.test.ts:1421` (drop the
  second run, the digests and the two `console.log` lines; drop
  `createHash` if unused); `textmon-registers.test.ts:393`;
  `tool-location.test.ts:795, 1300, 1658, 1754`;
  `capture-predicate.test.ts:188`; `skill-memory-map-cli.test.ts:179-182`;
  `diff-images.test.ts:349, 483-487`.
- Remove the unused type imports (`textmon-profile.test.ts:19`,
  `textmon-registers.test.ts:20`) and fix the section banners and headers
  that still promise determinism (`textmon-profile` 3-7 and 284-286,
  `textmon-registers` 504-506, `host-tool` 617-619, `tool-location` 20-21,
  `ghidra-live` 1798).
- No file may be left with zero tests, or with setup but no assertion.

## Task 5: Docs, standards and comments that cite the removed guards

- `agent-os/standards/broker/host-bound-modules.md:20, :26`: the CI step,
  not `resources-sync`/`entry-sync`, now catches a stale build.
- `agent-os/standards/skills/cross-package-reach.md:43`: the copies are
  kept identical by hand. No test checks it.
- `agent-os/product/tech-stack.md:64`. `roadmap.md`: move the cleanup item
  to Implemented (with the spec link), and record what is given up (a
  non-deterministic exporter/parser is no longer caught).
- `build.ts:328` `ENTRY_BANNER` (then run `node build.ts` and commit
  `vice-cli.mjs`), plus the `build.ts:153, 162, 197` comments,
  `install-resources.ts:340`, `anno-regbits-gen.mts:36`, `dxa-gate.ts:92, 96`,
  `disasm-opcodes.mts:8`, the `broker-kill.test.ts:1195` title, and the
  other comments that name the deleted tests. For any `.mts` you touch,
  run `node build.ts` and commit `resources/`.
- The 8 `skills/*/scripts/sibling.ts` headers (lines 15-17): make the same
  edit in all 8, then confirm they are still identical (one md5).
- Leave the old spec snapshots under `agent-os/specs/` unchanged. They are
  history.

## Verification

1. Baseline before Task 3, recorded in `census.md`. Redirect the output and
   read `$?` on the same line. Never pipe the output. Compare the set of
   failing tests, not only the count:
   - `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test > $SCRATCH/base.txt 2>&1; echo $?`
   - `node --test 'test/skills/**/*.test.ts'` from the repo root.
   - `npm run test:automated`.
2. After Tasks 3-5, run the same three commands again. The pass count
   must drop by exactly the number of deleted tests in the census, and the
   failing set must be unchanged. `npm run typecheck` must be clean.
3. `ghidra-live.test.ts` is opt-in. Run it alone under a timeout, with
   `VICE_LIVE_GHIDRA=1 GHIDRA_HOME=` set to the Ghidra install under
   `/home/henrik/dev/_ghidra-probe/` (find `analyzeHeadless`). If it cannot
   run, say so. Do not claim it passed.
4. Run the CI step script locally from a clean tree. It must exit 0. Then
   plant a one-line edit in a `.mts` without rebuilding. The step must exit
   non-zero. Revert the edit.
5. Re-run the census regex. Every remaining hit must be K or C in
   `census.md`.
6. Clean up the scratch dirs the suite leaks into `/tmp` after the runs.
   Then open the PR to `main`, with a short description.
