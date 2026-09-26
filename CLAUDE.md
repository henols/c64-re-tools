
## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. 
MCP, broker and reverse-engineering skills. The skills install with the `skills`
CLI (`npx skills add henols/c64-re-tools`) straight from this repo; the MCP server
and broker ship as the npm package `@henols/vice-mcp` and in the Claude Code plugin.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

## Technology Stack

## Project Type
## Languages
- TypeScript 
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files).
## Runtime
- Node.js ≥ 24. The MCP server ('@henols/vice-mcp') and the skill scripts
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp`  - MCP server/tooling framework
- `@mastra/core`  - underlying Mastra runtime


