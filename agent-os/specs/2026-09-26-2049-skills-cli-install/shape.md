# Skills-CLI Install and a Runnable npm Server — Shaping Notes

## Scope

Install the skills with the `skills` CLI that `/find-skills` uses
(vercel-labs, `npx skills add henols/c64-re-tools`) instead of our own npm
installer. Also make an npm-installed `@henols/vice-mcp` actually run, so any
agent can wire the MCP server with `npx add-mcp vice-mcp`. The broker stays
started by hand.

## Decisions

- **Owner decisions:**
  - Use the `skills` CLI and retire `@henols/c64-re-tools`. The owner deprecates
    the npm package by hand.
  - Move `src/skills/` to a root `skills/` folder. That is the default
    location for both the CLI and Claude Code plugins, so plugin.json needs no
    `skills` key.
  - The docs say to install all skills (`--skill '*'`). A missing sibling skill
    gets a refusal that names it, not `ERR_MODULE_NOT_FOUND`.
  - Move the skill tests and `test-corpus.ts` to `test/skills/`, and
    `danish.json` to `evidence/transients/`.
  - Also fix the npm server package.
- **Decided by me (standing "you decide"):**
  - Build the server into a gitignored `dist/` at publish time (`prepack`).
    Emitting beside the source would add about 80 committed files and break
    several tests.
  - Make runtime lookups layout-tolerant with the existing
    `[HERE, HERE/..]` idiom.
  - Skip the start-up resource deploy when running under `node_modules`.
  - The docs never suggest `add-mcp @henols/vice-mcp`: it writes an `npx`
    launch that installs on first run. Suggest `npm i -g` plus
    `add-mcp vice-mcp` instead.

### Decided during implementation

- **plugin.json has no `skills` key.** `claude plugin validate` passes. The only
  warning, about `CLAUDE.md` at the plugin root, was there before.
- **`test/package.json`** is `{"type":"module"}`, like each skill's `scripts/`.
  CI runs `node --test 'test/skills/**/*.test.ts'`, so the top-level
  `sibling.test.ts` is included.
- **Evidence.** `danish.json` and the transients `.gitignore` moved to
  `evidence/transients/`. The skill keeps only the method README. Users write
  derived lists to `recovery/transients/`, the project data root.
- **Sibling loading:**
  - `sibling.ts` exports `loadSibling()` (async verbs; top-level await in
    packer-finding and completeness-report) and `siblingOrRefuse()` (the
    import-time needs of diff-images and recovery-schema).
  - packer-finding keeps its API: a missing sibling becomes the oracle's
    `reason`.
- **completeness-report** keeps target `vice-proxy.ts`. `mcp-module.ts`
  rung 3 maps `x.ts` to `dist/x.js` (`publishedSubpath()`), so no switch to
  `vice-cli.mjs` was needed.
- **`@modelcontextprotocol/sdk` is declared** (1.30.0). `vice-proxy.ts` already
  imported it directly, and it came in only through `@mastra/mcp`. `mission.md`
  now says "exactly three" runtime dependencies. Flag this to the owner.
- **Rank-4 skew message.** It no longer names the retired package. The client
  and the broker ship in one package, so it says to start the broker from the
  same install.
- **Test trap fixed.** `prerequisites.test.ts` runs `npm pack --dry-run`. With
  `prepack` present, that built `dist/` on every run, so it now passes
  `--ignore-scripts`.
- **smoke-packed.ts** removes a `dist/` it created. A leftover `dist/` would
  shadow source edits when `vice-cli.mjs` runs from a checkout.
- **Measured with the real `skills` CLI** (v1.6.0 from the local cache,
  telemetry off, local path):
  - `--list` finds exactly the 8 skills.
  - `--skill '*' --copy` installs 52 files, with no tests, `test-corpus` or
    `danish.json`.
  - `c64-petcat` installed alone in a `"type":"commonjs"` project refuses by
    name.

## Facts from the skills CLI v1.6.0 source

- **Discovery:**
  - Checks the root `SKILL.md`, then `skills/`, then agent dirs such as
    `.agents/skills` and `.claude/skills`, then plugin-manifest `skills`
    arrays. A string value is iterated one character at a time.
  - Skips skills listed in `skills-lock.json`, and falls back to a full-depth
    walk only when it found nothing.
- **Copying:** it copies the whole skill folder. It excludes only
  `metadata.json`, `.git`, `__pycache__` and `__pypackages__`.
- **No MCP, no install scripts:** it has no MCP support and runs no install
  scripts.

## Traps

- **mcp-module in-repo rung.** It computes `<skills>/../mcp/vice`. After the
  move this must be `<repo>/src/mcp/vice`.
- **Negative path checks.** Three tests forbid the source path while requiring
  `.claude/skills/...`. The new source path `skills/...` is a substring of that,
  so anchor the check.
- **Silent skips.** Moved tests with a wrong MCP path skip instead of failing.
  Watch the skip count.
- **Import rule.** The import-rule regex misses dynamic `import()`. Widen it
  when the sibling loads become dynamic.
- **Load-time project root.** `diff-images.ts`/`recovery-schema.ts` call
  `projectRoot()` at module top, so a guarded sibling load must stay lazy.
- **backend-detect.** It reaches `tool-location` through `createRequire`, which
  no import scan sees. It must be a root of the server build.
- **memmap.json.** `memmap-lookup.ts` reaches the skill's `memmap.json` from
  outside the package. Ship a copy.

## Context

- **Visuals:** none.
- **References:** `references.md`.
- **Product alignment:** never auto-install (the user runs `npx skills` and
  `npm i -g` themselves), point-of-use refusals, TypeScript only.

## Standards Applied

- **skills/cross-package-reach:** rewritten. Skills come from git, sibling
  reach is guarded, and node_modules targets are compiled (`dist/` or
  `resources/`).
- **skills/script-results:** the `{ok,message}` envelope for sibling refusals.
- **skills/refuse-never-guess:** name the missing skill and the install command.
- **skills/skill-md-shape:** the `S=` path lines change to `skills/...`.
- **broker/host-bound-modules:** the server `dist/` build is neither host-bound
  nor an entry artifact.
- **global/module-header:** the new modules (`sibling.ts`, `smoke-packed.ts`).
