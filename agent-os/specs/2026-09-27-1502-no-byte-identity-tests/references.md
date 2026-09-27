# References for Removing the Byte-Identity Tests

## Origin

- **Old Phase 54, "Remove Every Byte-Identical Assertion"**, archived in
  commit `0be98e9a` (`.planning/ROADMAP.md`, section "Phase 54"). It gives
  the goal, the collateral trap (read each test before you delete it), the
  census-first ordering and the `resources-sync` replacement idea
  (`git diff --exit-code` after `node build.ts` in CI).

## The guards being replaced

- `src/mcp/vice/resources-sync.test.ts` and `src/mcp/vice/entry-sync.test.ts`
  drive `build()` and `buildEntries()` from `src/mcp/vice/build.ts` into a
  scratch directory and compare the result with the committed tree.
- `test/skills/sibling.test.ts` compares the `sibling.ts` copies.

## Generators the CI step runs

- `src/mcp/vice/build.ts` writes `resources/*.mjs`,
  `resources/prerequisites.json` and `vice-cli.mjs`.
- `src/mcp/vice/anno-regbits-gen.mts` writes `anno-regbits.json`.
- `src/mcp/vice/fixtures/*/make-*.ts` writes the committed fixtures.
  `shape.md` lists which ones the step runs, and why.
