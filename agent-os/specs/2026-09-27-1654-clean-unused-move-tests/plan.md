# Clean unused code and move the server tests to `test/vice/`

## Context

`src/mcp/vice/` (the `@henols/vice-mcp` package) mixes 156 colocated tests and about 20 test-only helpers with about 148 source files. Commit `276c15c9` deleted 43 tests but left their subject modules and fixtures behind. The roadmap's Cleanup section already lists "move the server's colocated tests into a dedicated test folder". The skill-script tests already live in `test/skills/`.

When this is done:
- No dead module, dead export, orphaned fixture or unused vendor file remains.
- `src/mcp/vice/` holds only production code and dev tooling (build, smoke, generators of committed artifacts).
- Every test and test helper lives in `test/vice/`.
- `npm test`, `test:automated`, `test:manual`, typecheck, smoke and CI stay green.

Owner decisions (2026-09-27 shaping):
- Tests go to top-level `test/vice/`, flat, with `fixtures/` moved to `test/vice/fixtures/`. Test helpers move with them.
- "Unused" covers all four kinds: unreferenced modules, unused exports and locals, test-only helpers, and unused fixture and vendor files.
- Code that only tests use is deleted, together with its tests. This includes the reassembly gate.
- Also removed: `probe-binmon.ts`, the `recovery-schema.ts` skill script, the root `.ts` sources in `files[]`, and the vendored dxa C sources with their `diff -rq` check.
- Extras in scope: fix every tsc `noUnusedLocals`/`noUnusedParameters` hit and turn both flags on, and fix stale comment and README references. Out of scope: removing `export` from symbols used only in their own file.

## Task 1: Save spec documentation

Create `agent-os/specs/2026-09-27-1654-clean-unused-move-tests/`:
- **plan.md**: this plan.
- **shape.md**: scope, the owner decisions above, and what is knowingly given up. That is the reassembly gate, the `anno-register` surface audit, the dxa upstream-tree check, and the ability to recapture binmon fixtures without writing a new probe.
- **standards.md**: full text of `global/module-header`, `broker/host-bound-modules`, `skills/cross-package-reach` and `global/injectable-deps`.
- **references.md**: `agent-os/specs/2026-09-27-1502-no-byte-identity-tests/` (census plus removal pattern, CI regenerate step), `agent-os/specs/2026-09-25-2240-deletion-cutover/`, the `test/skills/` layout (`HERE`/`SKILLS` path idiom in `test/skills/sibling.test.ts`).
- **census.md**: the per-item deletion list from Task 2, each item with its reach evidence (who imported, spawned, shipped or ran it: nobody). Built from the survey results and re-verified during Task 2.

## Task 2: Delete unused code (before the move, so fewer files move)

Reach rule: a file or symbol is live if any of these reaches it: a static or dynamic import, `new URL("./x")`, a spawn path, `resolveMcpModule("…")`, `package.json` `files[]` or scripts, `build.ts` `HOST_BOUND_ARTIFACTS`/`ENTRY_ARTIFACTS`, `tsconfig.*.json`, `ci.yml`, `.mcp.json`, or a SKILL.md command. Use `grep -a`, because four files contain NUL bytes. `XDeps` fields, `reset*ForTest` hooks and host-bound modules are never "unused".

1. **Dead modules**: `dxa-proof01-compare.ts`, `dxa-partition.ts`, `anno-symbols.ts` (and its `files[]` entry), `probe-binmon.ts`, `skills/c64-provenance/scripts/recovery-schema.ts`. Also remove its `sibling.test.ts` case and SKILL/comment mentions, and the `node probe-binmon.ts --capture` text in `binmon-fixtures.ts` and `fixtures/binmon/README.md`.
2. **Test-only code with its tests**:
   - `anno-register.ts`, `anno-register.test.ts`, and the cases in `anno-derivation.test.ts` and `anno-import.test.ts` that import it. Delete a whole file only if nothing live remains in it.
   - The reassembly gate: `reassembly-gate.ts`, `-ack`, `-movement`, `-movement-subject` and the five `reassembly-gate*.test.ts` files.
   - Keep `acme-verify.ts` and `acme-gate.ts`. CI's `make-exported-edit.ts` and the ACME tests still use them, and `tool-location-consumers.test.ts` pins `acme-gate.ts`.
3. **Test-only exports**, for example `superviseChild`, `callStockTool`, `countReady`, `countLaunching`, `readTransferHeader`, `readAttachLine`, `validateToolsFile`, `toolsFileTemplate`, `readProvenanceLedger`, `checkRenderedMemoryMap`, `brokerEpochFile`, `generateEnumsFromStore`, `crossCheckHazardFixture` and `formatConfidenceComment`. Verify each suspect first. If the symbol is also used inside its own module, drop only `export` and delete the test cases that call it directly. Otherwise delete the symbol and its test cases.
4. **Fully dead exports**, for example `PROVEN_TARGET_SOURCES`, `resourcesStatus`, `DeployManifest`, `BrokerIncidentTrigger`, `RelayAttachRequest`, `BrokerDeps`, `OracleTerm`, `TextCommand`, `validateHitLog` and `readJsonArtifact`.
5. **Orphaned fixtures**:
   - `fixtures/dxa/fixture.rep`, `fixtures/ghidra/runlog-benign-base0-conflict.txt`, `fixtures/ghidra/runlog-script-error.txt`, `fixtures/hazard-subject/hazard-subject-rebuild.prg`, and the four `fixtures/planted-*` files.
   - Then re-check every fixture's reader: fixtures used only by the tests deleted in step 2 go too.
   - Update the fixture READMEs to match.
6. **Package and vendor**:
   - Drop the root `.ts`/`.mts` sources from `src/mcp/vice/package.json` `files[]`. Keep `dist/`, `resources`, the JSON data files, the docs and `vendor/*`.
   - Check first that `dist/` code reads no JSON by a path relative to itself. `vice-proxy.ts:487` reads `tools-manifest.stock.json`.
   - Delete the committed dxa upstream C sources and `tests/` under `vendor/dxa/`, and the `diff -rq` step in `build.bash`. Rewrite `vendor/dxa/README.md`: it also cites a missing `scripts/check-npm-packages.mjs`.
7. Run `node build.ts` if any host-bound source changed, and commit the regenerated `.mjs` files.

## Task 3: Move tests and test helpers to `test/vice/`

**Moves** (`git mv`, history kept):
- All `*.test.ts` and `*.test.mts` files, and `fixtures/` → `test/vice/fixtures/`.
- Test helpers: `binmon-fixtures.ts`, `textmon-fixtures.ts`, `stock-session-fixtures.ts`, `workspace-store-fixture.ts`, `broker-harness.ts`, `store-durability-mutator.ts`, `store-schema-v2-fixture.ts`, `project-race-holder.ts`, `stock-schema-check.ts`, `acme-gate.ts`, `acme-verify.ts`, `dxa-gate.ts`, `test-gate.ts`.
- **Stay in the package:** `smoke.ts`, `smoke-packed.ts`, `build.ts`, `anno-regbits-gen.mts`, `prereq-readme-gen.ts`. npm scripts, CI and the README run these as tooling.

**Path seam.** Add `test/vice/paths.ts`, a module with a header per module-header. It exports `VICE_DIR` (the package), `TEST_VICE_DIR`, `FIXTURES_DIR`, `REPO_ROOT` and `SKILLS_DIR`. Rewrite these patterns with a scratchpad `.ts` codemod (never `node -e`; read and write whole files so NUL bytes survive; check afterwards with `indexOf(0)`):
- `from "./x"`, `import("./x")` and `typeof import("./x")` → `../../src/mcp/vice/x` when the target is a package module, `./x` when it is a moved helper. That is 698 lines.
- `join(HERE, "<package file>")`, `join(HERE, "resources", …)` and `new URL("./resources/…", import.meta.url)` → `VICE_DIR`.
- `join(HERE, "fixtures", …)` and `"fixtures/…"` strings → `FIXTURES_DIR`.
- `HERE, "..", "..", ".."` repo-root joins and `../../../skills/` imports → `REPO_ROOT` / `../../skills/`.
- `cwd: HERE` for `npm pack`, `git ls-files` and build → `VICE_DIR`.
- `readdirSync(HERE)` source scans → `VICE_DIR`. Scans that deliberately include tests (`service-no-invoke`, `anno-cli-path-consumers`) also scan `TEST_VICE_DIR`.
- Hard-coded `ALLOWED` name sets (`broker-control`, `text-connect`, `broker-relay:1602`) and the `path-seam-absent:155` expectation: update them to the new relative paths.
- Where a path must keep meaning the package, it stays on `VICE_DIR`: `dxa-seam`/`host-tool` dxa planting, `build-atomic` staging, and `dxa-gate`'s `findDxaBinary`.
- In-workspace scratch dirs (`anno-cli.test.ts:196`, `anno-memmap-render.test.ts`) may land in `test/vice/`. They are still inside the git root and still cleaned up in `finally`.

**Production fix.** `anno-cli.ts:1564` resolves the decomp image as `join(HERE, "fixtures", entry.path)`. Change it to resolve against `dirname(manifestPath)`, so production never knows about test fixtures. Update `skills/c64-annotations/SKILL.md:558-559` to `--manifest test/vice/fixtures/decomp-execution-manifest.json`.

**Callers outside `test/vice`:**
- `test/skills/c64-basic/petcat.test.ts`, `c64-disk/c1541.test.ts`, `c64-annotations/completeness-report.test.ts` and `c64-ram-capture/vsf-slice.test.ts` → `../../vice/broker-harness.ts` etc., and fixture paths → `test/vice/fixtures`.
- `test/vice/fixtures/**/make-*.ts` generators: `VICE_DIR` joins and `../../anno-store.mts` → the package path. `make-exported-edit.ts` → `../../acme-verify.ts`.

**Infrastructure:**
- `src/mcp/vice/package.json`:
  - `"test": "node --test '../../../test/vice/*.test.ts' '../../../test/vice/*.test.mts'"`
  - `test:automated` → `node ../../../test/vice/test-gate.ts`, and the same for `test:manual`.
- `test-gate.ts`: read its own folder (`import.meta.dirname`), not `process.cwd()`, and pass absolute paths to `node --test`. `MANUAL_ONLY_TESTS` stays bare names.
- `src/mcp/vice/tsconfig.json`: add `../../../test/**/*.mts` to `include`.
- `.github/workflows/ci.yml`:
  - Repoint the `skill-assembler-cli.test.ts` step.
  - Run the regenerate step's generators from `../../../test/vice/fixtures/…`.
  - Widen `git diff`/`git status` to `-- . ../../../test/vice`.
  - Update the `git checkout -- …/exported-edit-run.json` path and the `broker-harness.ts` comment.

## Task 4: tsc unused locals and parameters

After the move, fix every `--noUnusedLocals --noUnusedParameters` hit (194 before Task 2, about 170 of them unused test imports). Examples: `defaultExportAsmOut()` in `anno-cli.ts`, the unused `HERE` in five skill scripts, and `VOLATILE_START`. A parameter needed only for a signature gets a `_` prefix. Then set both flags in `src/mcp/vice/tsconfig.json`, so `npm run typecheck` keeps the tree clean.

## Task 5: Stale references and docs

- Fix comments that cite deleted or moved files (105 names, e.g. `vice.ts`, `vice-sync.ts`, `make-rebuild.mjs`, `module-classification.ts`, deleted `*.test.ts`). Either point to the live file or drop the clause. Moved tests cited by bare name are fine.
- Fix the `.gitignore` comment about `scripts/audit-gate.mjs`, and `fixtures/dxa/README.md` and `fixtures/ghidra/README.md`.
- Update the docs: `README.md:313,367` (layout), `src/mcp/vice/README.md:129-141`, `agent-os/product/tech-stack.md` ("Server tests live in `test/vice/`"), and `agent-os/product/roadmap.md` (move the Cleanup item to Implemented, with the spec path). Historical `agent-os/specs/` stay untouched.
- Doc prose follows `asd-ste100` (memory: all skill docs go through it; run `ste-lint.py` on the changed SKILL.md).

Commit each task separately on the current branch or a new one (`clean-unused-move-tests`).

## Verification

Baseline before Task 2: record the failing **set**, not the count. Redirect output and read `$?` on the same line; never pipe to `tail`.
1. `cd src/mcp/vice && npm run typecheck` (with the new flags) exits 0.
2. `npm test > $SCRATCH/t.log 2>&1; echo $?` exits 0. The pass/skip totals drop only by the deleted tests. Confirm with `ls ../../../test/vice/*.test.*` that the glob matches every file, because `node --test` silently skips missing names.
3. `npm run test:automated` exits 0 with zero failures, and `npm run test:manual` loads every `MANUAL_ONLY_TESTS` file (default-SKIP without the env vars).
4. `node --test 'test/skills/**/*.test.ts'` from the repo root exits 0.
5. `npm run smoke` and `node smoke-packed.ts` pass. `npm pack --dry-run` lists no root `.ts` sources and still lists `dist/`, `resources/`, the JSON files and `vendor/`.
6. Run the CI regenerate-step script locally from `src/mcp/vice`: a clean tree exits 0.
7. `git grep -a -nE "src/mcp/vice/(fixtures|[a-z-]+\.test\.)"` outside `agent-os/specs/` returns nothing. `ls src/mcp/vice/*.test.* src/mcp/vice/fixtures` finds nothing.
8. Optional live check: one live suite (e.g. `VICE_LIVE_*` `stock-live.test.ts`) against `/usr/bin/x64sc`, alone and under a timeout, to prove that relocated resource paths resolve.
