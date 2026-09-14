---
title: Skill installer routes surveyed — why neither generic installer replaces this repo's two
date: 2026-09-14
context: /gsd-explore — "what default installers are available to install skills used by e.g. gsd and asd-ste100?"
---

# Skill installer routes surveyed

## Question

Is there a *default* installer for Claude Code skills that this repo could adopt in
place of the two distribution routes it maintains?

## Answer: no default exists; six distinct routes are in use

Measured on this machine 2026-09-14. Every row was observed directly on disk, not
recalled.

| Route | Mechanism | Evidence |
|---|---|---|
| Claude Code plugin marketplace | `/plugin marketplace add` → `/plugin install <name>@<marketplace>`; skills ride inside a plugin | `~/.claude/plugins/installed_plugins.json` — 4 plugins installed; `known_marketplaces.json` — `anthropics/claude-plugins-official` (github source) and `gitkraken` (directory source) |
| Skills CLI (`npx skills`) | The only vendor-neutral route: `find` / `add` / `check` / `update` | `~/.claude/skills/find-skills/SKILL.md` |
| Vendor npx installer | Each vendor ships its own CLI that copies skills and wires config | GSD: `npx -y @opengsd/gsd-core@latest --claude --local`. This repo: `installer/bin/cli.mjs` |
| Bespoke shell installer + git clone | `git clone --depth 1` upstream → copy into `~/.claude/skills/` → stamp the commit | `setup-claude-ste100.sh:449` clones `danyuchn/asd-ste100-skill`; target carries `.upstream-commit` = `7d4a135a199a5d7447c4886bcd7ffe742a627bc9` |
| Language package manager | `uv tool install` etc. — installs a binary; the skill dir is a side effect | `~/.claude/skills/graphify/.graphify_version` = `0.8.30` |
| Manual copy | Drop a directory into `~/.claude/skills/<name>/` or `<project>/.claude/skills/<name>/` | `.claude/skills/mastra` in this repo |

GSD and asd-ste100 answer the question by contrast: GSD reimplemented an installer
as an npm CLI, asd-ste100 reimplemented one as a bash script with its own version
stamping. Neither used a shared mechanism.

## Why no generic route can replace either of this repo's two

1. **The generic routes carry skills only.** This repo's skills are not merely
   degraded without the `vice` MCP server — per the project's own compatibility
   constraint, a skill written against a tool the server does not advertise
   *breaks* rather than degrades. A skills-only installer therefore produces a
   broken install, not a partial one.
2. **The npm route buys no runtime portability.** It writes to
   `<target>/.claude/skills/` (`installer/bin/cli.mjs:156`), exactly like the
   plugin. Both are Claude-Code-only.

## What the two shipped routes cost

`installer/skills/` is a GENERATED, GITIGNORED tree (`.gitignore:52`) regenerated
at prepack — there is no committed duplicate and no divergence risk. The cost is a
generator, not two copies in git.

| | Plugin marketplace | npm installer |
|---|---|---|
| Skills | `"skills": "./src/skills/"` — declarative | 194-line `installer/scripts/sync-skills.mjs` + prepack |
| MCP server | `"mcpServers": "./.mcp.json"` — declarative | `wireMcp()` — JSON merge that must not clobber other servers, + 18 tests |
| Dependencies | `SessionStart` hook | `--vendor` / `npx -y ...@version` pin resolution |
| Release | version stamp | 418-line `scripts/check-npm-packages.mjs` tarball gate + a second OIDC publish job, ordered (vice-mcp first — "the installer depends on this exact version", `.github/workflows/ci.yml:331`) |

Roughly ~900 lines of installer infrastructure plus a publish-ordering coupling
exist so one audience can install without enabling a plugin.

## Decision

**Both routes stay.** Confirmed 2026-09-14: the npm-installer audience is real and
known — users who cannot or will not enable a marketplace plugin. The ~900 lines
buy something measurable. "Retire the npm route" is closed, not deferred.

## Unresolved

DATA_k7qm2xva_START
Claim: "`npx skills` cannot wire an MCP server into a consumer's `.mcp.json`."
Disposition: **non-authoritative source**. Grounded only in the locally-installed
`~/.claude/skills/find-skills/SKILL.md`, which lists four commands (`find`, `add`,
`check`, `update`), none MCP-related. Absence of mention in a skill's own
documentation is not authoritative on that CLI's full capability.
Effect on the decision: none — the plugin route already carries the MCP server
declaratively at no cost, so the conclusion does not rest on this claim. Do not
restate it as settled fact without a primary source.
DATA_k7qm2xva_END
