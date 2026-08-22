---
phase: 16
slug: packaging-and-repo-shape
created: 2026-08-22
---

# Phase 16 — API Coverage

No external API integration: this phase relocates the plugin payload inside its own
repository (`.claude/mcp/vice/` and `.claude/skills/` → `src/mcp/vice/` and `src/skills/`),
adds tests for three first-party CLI scripts, adds a source-comment guard, and records a
network-exposure decision — every capability it touches is first-party code already in this
tree.

Detector result (deterministic scan over the ROADMAP Phase 16 section, fenced blocks
stripped): `{"detected": false, "signals": []}`.

Two near-misses worth naming, so a later reader does not read this declaration as an
oversight:

- **MCP is in the phase's vocabulary** (`.mcp.json`, `vice-proxy.ts`, `mcpServers`). The MCP
  *server* is this repository's own product, and this phase changes only where its source
  files sit on disk plus one manifest path literal. No MCP client is written against a
  third-party server, and no tool surface grows or shrinks: the published tarball's
  73-entry file list is asserted byte-identical before and after the move (plan 16-04).
- **Claude Code's plugin loader** is an external consumer of two manifest fields
  (`.claude-plugin/plugin.json`'s `skills` and `mcpServers`). It is a host, not an API this
  phase integrates: the only thing consumed from it is the published manifest JSON schema's
  path constraint (`^\./.*` on both fields, no `.claude/` requirement), read once to confirm
  `"./src/skills/"` is a legal value. There is no request/response surface to enumerate.
