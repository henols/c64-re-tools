---
created: 2026-08-20T08:12:00.000Z
title: Relocate the plugin payload (MCP server + skills + mcpServers config) under a source directory so it only activates when properly installed, and make install merge into .mcp.json instead of supplying the whole file
area: packaging
files:
  - .claude/mcp/vice/
  - .claude/skills/
  - .mcp.json
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - installer/bin/cli.mjs:168-201
  - installer/scripts/sync-skills.mjs
  - scripts/package.sh
  - scripts/ensure-mcp-deps.sh
  - scripts/check-npm-packages.mjs
  - .claude/mcp/vice/package.json
  - .gitignore
  - CLAUDE.md
resolves_phase: 16
---

## Problem

**The repository root *is* the plugin payload.** `.claude/skills/` (six skills),
`.claude/mcp/vice/` (~70 TypeScript modules plus their colocated tests), and `.mcp.json`
all live at repo root in exactly the positions Claude Code auto-discovers. Consequences:

1. **No install step is required to activate the tooling.** Any Claude Code session opened
   on this repo picks up all six skills as *project* skills and launches the `vice` MCP
   server straight from the working tree — no version gate, no dependency check, no
   consent. This session demonstrates it: CLAUDE.md's "Project Skills" table enumerates
   all six from `.claude/skills/`, and `.mcp.json` at root starts the server.
2. **Development-in-place and installed-consumer are indistinguishable.** Because the dev
   repo activates through the same discovery paths a correct install would use, "it works
   in the repo" is never evidence that "it works when installed." Install-path defects
   (missing `files[]` entry, unresolved `${CLAUDE_PLUGIN_ROOT}`, un-provisioned
   `node_modules`) are structurally invisible locally.
3. **`.mcp.json` does double duty and therefore cannot be merged.** The same root file is
   both this repo's own dev MCP config *and* the plugin's declared server manifest
   (`.claude-plugin/plugin.json` → `"mcpServers": "./.mcp.json"`). The plugin route
   consumes the file wholesale, so a consumer's existing MCP servers are simply outside
   its model. This is the "install can't just copy `.mcp.json`" complaint: the file must
   be *read, edited, and appended to*, never handed over intact.

**The npm route already does this correctly; the plugin route does not.** `wireMcp()` at
`installer/bin/cli.mjs:168-201` reads the target's `.mcp.json`, refuses (rather than
overwrites) on invalid JSON, coerces a missing `mcpServers` to an object, then sets *only*
the `vice` key and preserves every other server — and leaves a pre-existing `vice` entry
alone unless `--force`. That is the desired semantics, already written. The gap is that
nothing routes the plugin install through it, and nothing *asserts* the property:
`scripts/package.sh` validates only that `.mcp.json`'s vice `args` mention
`${CLAUDE_PLUGIN_ROOT}` — no check anywhere covers non-clobbering merge.

### The layout is load-bearing in many places

A move touches every one of these; none can be skipped, and at least six tests assert the
current shape (so drift surfaces as failures, not silence):

| Reference | What it pins |
|---|---|
| `.claude-plugin/plugin.json` | `skills: "./.claude/skills/"`, `mcpServers: "./.mcp.json"`, hook `${CLAUDE_PLUGIN_ROOT}/scripts/ensure-mcp-deps.sh` |
| `.mcp.json` | `${CLAUDE_PLUGIN_ROOT}/.claude/mcp/vice/vice-proxy.ts` |
| `scripts/package.sh` | hardcoded `mustExist` list (`.claude/mcp/vice/package.json`, `package-lock.json`, `vice-proxy.ts`), `.claude/skills` SKILL.md enumeration, cross-manifest version checks, and the zip guard rejecting any `node_modules/` or `tools/` entry in the artifact |
| `scripts/ensure-mcp-deps.sh` | `npm ci` target directory |
| `installer/scripts/sync-skills.mjs` | canonical `.claude/skills/` → `installer/skills/` |
| `.claude/mcp/vice/package.json` | a ~50-entry explicit `files[]` allowlist, `bin.vice-mcp`, `main` |
| `.gitignore` | `/installer/skills/`, the per-file `/tools/*.mjs` list (kept per-file so `host-scripts.test.ts`'s two-way parity gate holds) |
| `scripts/check-npm-packages.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-tool-coverage.mjs` | tarball contents and skill paths |
| `resources-sync.test.ts`, `host-scripts.test.ts`, `load-order.test.ts`, `build-atomic.test.ts`, `hostpath-consumers.test.ts` | layout + the documented closed consumer set for host-path logic |
| `.github/workflows/ci.yml` | working-directory paths |
| `CLAUDE.md` | cites `.claude/mcp/vice/*` in nearly every section, including the D-07 constraint's `vice-proxy.ts:2889` / `vice-proxy.ts:1368` anchors |

Note that because the shipped server runs on Node type-stripping (no build step), the
`.ts` files **are** the runtime artifacts. This is not a build-output relocation — it moves
the published package's file paths and its `bin` target, which is a breaking change for
anyone who pins them. `build.ts` additionally asserts the emitted `resources/*.mjs` set
matches `resourceEntries()` exactly, so the generated-but-committed artifacts move in
lockstep.

### The tension that has to be decided, not assumed

"Only accessible when installed correctly" directly conflicts with this repo dogfooding its
own plugin. Today the skills and MCP server are developed *by using them* in this session.
Move them out of the auto-discovery paths and that stops working unless a deliberate
dev-mode route replaces it. That decision drives everything else and should be made first.

## Solution

1. **Decide the dev-time story first** — it is the load-bearing choice. Options:
   (a) install the plugin from a local marketplace source pointing at the repo
   (`marketplace.json` already declares `"source": "./"`, so this may be nearly free);
   (b) a gitignored `.claude/settings.local.json` dev opt-in that points at the relocated
   payload; (c) accept losing in-repo autoload and drive everything through a real install.
   Record the choice and its cost.
2. **Fix the target layout and name it.** Proposal: `src/mcp/vice/**` and `src/skills/**`,
   with root `.claude/` reduced to genuinely repo-local dev config (settings, worktrees) and
   carrying no auto-discoverable payload. Confirm Claude Code will accept `skills:` and
   `mcpServers:` manifest paths pointing inside `src/` before committing to it.
3. **Make install merge, at install time.** The plugin manifest's `mcpServers` is a
   whole-file reference, so the merge cannot live in the manifest — route both install paths
   through one installer that reads the consumer's `.mcp.json` and writes only the `vice`
   key. Reuse `wireMcp()` (`installer/bin/cli.mjs:168-201`) as the single seam; do not
   reimplement the merge. If Claude Code's plugin semantics genuinely cannot be made to
   merge, state that plainly and instead move the plugin's own server file *inside* `src/`
   (so it no longer doubles as this repo's dev config) and document which route merges and
   which owns its file.
4. **Gate both properties fail-closed**, or they will regress:
   - a test asserting the installer preserves pre-existing non-`vice` `mcpServers` keys
     (and still refuses invalid JSON rather than overwriting);
   - a `package.sh` check that no auto-discoverable skill or MCP payload exists at repo
     root — i.e. "only when installed" is enforced, not merely intended.
5. **Sweep every reference in the table above**, then re-run the whole gate set: `npm test`
   in the MCP directory, `scripts/package.sh`, `scripts/check-npm-packages.mjs`, and CI.
6. **Update CLAUDE.md's path citations**, including the D-07 constraint whose anchors are
   `vice-proxy.ts:2889` and `vice-proxy.ts:1368`. That bullet already warns line numbers
   drift per phase; a directory move invalidates the *paths* as well.
7. **Decide the release semantics.** `@henols/vice-mcp`'s `bin`/`main` paths move, which
   breaks anyone pinning them. Choose between a minor with a compatibility shim at the old
   path and a major version bump, and note it in the release notes either way.

**Sizing:** this is roadmap-scale — a layout migration across two published packages, the
plugin manifest, the packaging script, CI, and roughly six layout-asserting tests. Route it
through `/gsd-phase` (add a phase) rather than `/gsd-quick`. Step 1's decision is a good
`/gsd-discuss-phase` input.
