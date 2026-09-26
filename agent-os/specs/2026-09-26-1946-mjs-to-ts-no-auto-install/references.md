# References for .mjs → TypeScript and Never Auto-Install

## Similar Implementations

### The host-bound compile path

- **Location:** `src/mcp/vice/build.ts`, `tsconfig.build.json`,
  `resources-sync.test.ts`
- **Relevance:** the existing `.mts` → `resources/*.mjs` build, with a generated
  banner, staging, atomic rename and a drift test.
- **Key patterns:** reuse the staging and rename steps and the banner for the
  new `ENTRY_ARTIFACTS` path. Put the banner after the shebang.

### Converted TypeScript modules

- **Location:** `src/mcp/vice/*.ts` (e.g. `dxa-partition.ts`, `build.ts`)
- **Relevance:** `.ts` import specifiers, erasable syntax only, run as
  `node file.ts`.
- **Key patterns:** the main guard
  `resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)`, the module
  header, and `import type` for type-only edges.

### The plugin MCP route

- **Location:** `.mcp.json`, `.claude-plugin/plugin.json`
- **Relevance:** the supported, non-installing way to run the server
  (`node ${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts`).

### Planted-violation structural tests

- **Location:** `src/mcp/vice/path-seam-absent.test.ts`
- **Relevance:** the pattern for a structural guard that cannot pass vacuously.
  `no-handwritten-mjs.test.ts` copies it.

## Files changed by this work

- **Installer:** `installer/bin/cli.mjs` → `cli.mts` (compiled to `cli.mjs`),
  `installer/scripts/sync-skills.mjs` → `.ts`,
  `installer/wire-mcp.test.mjs` → `cli.test.ts`, `installer/package.json`.
- **Remedy text:** `src/mcp/vice/broker-endpoint.mts` (`BROKER_START_COMMAND`),
  `anno-cli.ts` (`NPX_INVOCATION`),
  `src/skills/c64-ram-capture/scripts/mcp-module` (the `--vendor` refusal).
- **Skill hub:** `src/skills/c64-ram-capture/scripts/mcp-module`, imported by
  acme, c1541, petcat, packer-finding, vsf-slice and completeness-report.
- **CI:** `.github/workflows/ci.yml`, for the skill-test glob, installer test,
  smoke, test-gate and publish stamping.
