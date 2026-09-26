# References for Skills-CLI Install and a Runnable npm Server

## External tools

### `skills` CLI (vercel-labs)

- **Location:** npm `skills` v1.6.0; source cached at
  `~/.npm/_npx/ac0ed6aa23b37c1e/node_modules/skills/dist/cli.mjs`
- **Relevance:** the installer this work adopts.
- **Key code:**
  - `discoverSkills()` holds the priority dirs, the lock-file skip and the
    full-depth fallback.
  - `getPluginSkillPaths()` expects an array of `./` paths.
  - `copyDirectory()` has a minimal exclude list.

### add-mcp (neon-solutions)

- **Location:** https://github.com/neon-solutions/add-mcp
- **Relevance:** writes MCP configs for 24+ agents from a local command, an npm
  package or a URL. Used in the docs as `npx add-mcp vice-mcp` after the user
  runs `npm i -g @henols/vice-mcp`.

## In-repo patterns

### Build output with staging, assertion and rename

- **Location:** `src/mcp/vice/build.ts` (`build()`, `buildEntries()`)
- **Key patterns:** assert the emitted set, then rename atomically.
  `HOST_BOUND_DATA_FILES` copies data files beside the compiled output.

### Layout-tolerant lookups

- **Location:** `broker-endpoint.mts:138`, `tool-location.mts:282`
- **Key patterns:** try `[HERE, HERE/..]` so a file works both in place and
  from one level down.

### Smoke handshake

- **Location:** `src/mcp/vice/smoke.ts`
- **Key patterns:** takes an executable argument, sends `initialize` and
  `tools/list`, and is reused by `smoke-packed.ts`.

### Refusal envelopes

- **Location:** `skills/c64-ram-capture/scripts/mcp-module.ts`
  (`refusalMessage`, `invokeHostTool`)
- **Key patterns:** return `{ok:false, message}` and never reject. The sibling
  loader follows the same shape.
