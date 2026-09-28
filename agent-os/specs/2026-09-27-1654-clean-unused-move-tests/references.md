# References for Clean Unused Code and Move Tests

## Prior specs

- `agent-os/specs/2026-09-27-1502-no-byte-identity-tests/` uses the same
  pattern: a census first, then removal, and a CI step that regenerates
  committed artifacts and fails on drift. This spec moves that step's
  generators to `test/vice/fixtures/` and widens its drift check.
- `agent-os/specs/2026-09-25-2240-deletion-cutover/` is an earlier
  deletion pass. Commit `276c15c9` in that line of work deleted 43 tests
  and left their subject modules and fixtures behind, which this spec
  removes.

## Layout to copy

- `test/skills/<skill>/` holds the skill-script tests outside the skill
  folders. `test/skills/sibling.test.ts` shows the path idiom:
  `const HERE = dirname(fileURLToPath(import.meta.url))` and repo paths
  joined from it. `test/package.json` (`{"type":"module"}`) already covers
  `test/vice/`.
- `src/mcp/vice/tsconfig.json` already includes `../../../test/**/*.ts`,
  so typecheck covers `test/vice/` once `.mts` is added.

## Roadmap

- `agent-os/product/roadmap.md`, "Cleanup": "Optionally, move the server's
  colocated tests into a dedicated test folder."
