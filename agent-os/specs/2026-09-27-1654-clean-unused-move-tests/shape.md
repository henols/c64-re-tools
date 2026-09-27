# Shape: clean unused code and move the server tests to `test/vice/`

## Scope

Delete all unused code in `@henols/vice-mcp`, the skill scripts and their
tests. Then move every server test, test helper and fixture from
`src/mcp/vice/` to a new top-level `test/vice/`, beside `test/skills/`.
After this, `src/mcp/vice/` holds only production code and dev tooling.
The per-item deletion list is in `census.md`.

## Owner decisions (2026-09-27)

- Tests go to `test/vice/`, flat, not to `src/mcp/vice/test/` and not
  split per area. `fixtures/` becomes `test/vice/fixtures/`.
- Helpers that only tests import move with the tests.
- "Unused" means all four kinds:
  - modules that nothing imports, spawns, builds, ships or runs;
  - unused exports and locals;
  - code that only tests use;
  - fixture and vendor files that nothing reads.
- Code that only tests use is deleted together with its tests. This
  includes the reassembly gate (four modules, five tests) and
  `anno-register.ts`.
- Also removed:
  - `probe-binmon.ts`, the manual binmon fixture recapture tool;
  - `skills/c64-provenance/scripts/recovery-schema.ts`, which no SKILL.md
    documents;
  - the root `.ts`/`.mts` sources in `package.json` `files[]` (from npm,
    Node runs `dist/` and `resources/*.mjs` only);
  - the committed dxa upstream C sources and the `diff -rq` check that
    compared them with the tarball.
- Extras in scope:
  - fix every `noUnusedLocals`/`noUnusedParameters` hit and turn both
    flags on;
  - fix comment and README references to files that no longer exist.
- Out of scope: removing `export` from symbols that are used only in their
  own file.

## Decisions made while shaping

- `anno-cli.ts` resolved the decomp fixture image beside itself
  (`join(HERE, "fixtures", …)`). It now resolves the image beside the
  manifest file, so production code never knows where test fixtures live.
- `smoke.ts`, `smoke-packed.ts`, `build.ts`, `anno-regbits-gen.mts` and
  `prereq-readme-gen.ts` stay in the package. npm scripts, CI and the
  README run them as tooling. `test-gate.ts` moves, because it only selects
  tests.
- Tests reach package paths through one module, `test/vice/paths.ts`, not
  through ad-hoc `"..", "..", ".."` joins.
- No test imports a bare npm package. A package module that a test imports
  by relative path still resolves its own `node_modules`, so `test/vice/`
  needs no `package.json` dependencies.

## What is knowingly given up

- The reassembly gate and its verdict tests.
- The `anno-register` record of verbs that the upstream manifest does not
  classify, and the tests that pinned it.
- The check that the committed dxa sources equal the upstream tarball.
- Recapturing the binmon fixtures from a real VICE. That now needs a new
  probe.
- Direct unit tests of exports that production never calls.
