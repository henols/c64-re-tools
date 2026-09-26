# .mjs → TypeScript and Never Auto-Install — Shaping Notes

## Scope

Two roadmap cleanup items (`product/roadmap.md`, Cleanup):

- Convert every remaining hand-written `.mjs`: 45 files, about 16k lines.
  - The installer: `bin/cli`, `scripts/sync-skills`, `wire-mcp.test`.
  - 30 skill scripts under `src/skills/*/scripts/`.
  - 12 files in `src/mcp/vice`: `vice-cli`, `test-gate`, `smoke`,
    `probe-binmon`, two test helpers and six fixture generators.
  - The 22 `resources/*.mjs` are `build.ts` output and are not in scope.
- Enforce never-auto-install. The installer wrote `npx -y @henols/vice-mcp@<ver>`
  into a consumer's `.mcp.json`. Its `--vendor` route ran `npm install` and then
  wired bare `npx`, which also installs silently when there is no TTY. The shipped
  remedy text told people to run `npx -y … broker` and `npx -y … anno`.

## Decisions

- **The installer stops wiring MCP.** It installs skills only. Removed: the
  `.mcp.json` write, `--vendor`, the dev-placeholder `@latest` fallback and the
  `@henols/vice-mcp` dependency. The MCP server comes from the Claude Code plugin.
- **No shipped text says `npx -y`.** The broker and anno remedies use the
  plugin/checkout form.
- **Skill scripts become `.ts`,** and each skill's `scripts/` gets a
  `package.json` of `{"type":"module"}`. Skills install into
  `<consumer>/.claude/skills/`, where the consumer's own `package.json` would
  otherwise decide the module type. A `"type":"commonjs"` there would break an
  ESM `.ts`.
- **Bins that load from `node_modules` are compiled.** `vice-cli` and the
  installer CLI become `.mts` sources. A new `build.ts` `ENTRY_ARTIFACTS` path
  emits each one beside its source. They are not host-bound, and
  `install-resources` never deploys them.
- **Known and left open:** the npm-installed server cannot start, because
  `vice-cli` imports `vice-proxy.ts`, which Node does not strip under
  `node_modules`. Fixing it means compiling the whole server graph. It stays a
  roadmap defect, and the plugin is the supported MCP route.
- **Everything hand-written is converted,** including the manual `probe-binmon`
  and the fixture generators.

### Decided during implementation

- **Broker remedy:** `BROKER_START_COMMAND` is
  `node <plugin-root>/src/mcp/vice/vice-cli.mjs broker`. Measured: that
  command started a broker that bound loopback plus both bridge gateways and
  shut down cleanly.
- **The anno usage** keeps only the plugin/in-repo form. The refusal in
  `mcp-module.ts` names `VICE_MCP_DIR` and the plugin.
- **Entry build:** `vice-cli.mts` holds both dispatch targets in variables,
  so tsc compiles it alone. Its banner goes after the shebang, and
  `entry-sync.test.ts` checks for drift.
- **The two anno test helpers were renamed** `store-durability-mutator.ts` and
  `store-schema-v2-fixture.ts`.
- **`probe-binmon.ts` resolves x64sc** with `resolveTool()`, for its
  provenance string only. It still spawns `c1541` via `command -v`, as before;
  that is out of scope.
- **The vsf sidecars were regenerated:** the `.vsf` sha256 values are
  unchanged, and only `command`, `capturedFrom` and `capturedAt` moved.
  `exported-edit.manifest.json` still says `make-exported-edit.mjs`, because
  `exported-edit-run.json` records that manifest's sha256.
- **Measured:** an installed skill script runs inside a
  `"type":"commonjs"` consumer only with its `scripts/package.json`. Without
  it, Node crashes.

## Traps found in research

- `recovery-schema`'s `listMjsFiles` filters `.mjs`. After the rename it would
  scan 0 files and still report OK.
- The `sync-skills` `isNonShipping` filter only knows `.test.mjs` and
  `test-corpus.mjs`, so the converted test files would ship.
- The CI skill-test glob is `*.test.mjs`, and `node --test` skips a glob that
  matches nothing and still exits 0.
- Three `@ts-expect-error` imports of skill scripts in `src/mcp/vice` tests become
  unused (TS2578) once the targets are `.ts`.
- `anno-seam.test.ts` requires every `anno-*.ts` in `files[]`. The two test
  helpers must drop the `anno-` prefix.
- `tool-location-consumers.test.ts` forbids `VICE_BIN` env reads in top-level
  `.ts`, and `probe-binmon` reads it.
- Source-reading tests (the hazard-subject generators, `packer-finding`,
  `derive-transients`, `vsf-slice`) match exact source lines. Type annotations
  must not change those lines.
- The committed `fixtures/vsf/*.json` sidecars embed the generator's filename.
- `packer-finding`'s main guard checks for the `.mjs` extension.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:** TypeScript only (`tech-stack.md`), never auto-install
  (`mission.md`), point-of-use refusals.

## Standards Applied

- **skills/script-results:** skill scripts are `.ts` on Node ≥ 24.
- **skills/cross-package-reach:** no static import across packages. `.mjs`
  resolve targets stay compiled.
- **broker/host-bound-modules:** `broker-endpoint.mts` is rebuilt. Entry
  artifacts are not host-bound.
- **global/module-header:** every converted non-test module gets the header.
- **skills/skill-md-shape:** `SKILL.md` invocation lines are updated.
- **skills/refuse-never-guess:** `--vendor` and unknown flags are refused.
