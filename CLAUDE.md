
## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. 
MCP, broker and reverse-engineering skills, distributed both as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`).

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

## Technology Stack

## Project Type
## Languages
- TypeScript 
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `src/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files).
## Runtime
- Node.js. The MCP server ('@henols/vice-mcp')
- The installer package ('@henols/c64-re-tools') 
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp`  - MCP server/tooling framework
- `@mastra/core`  - underlying Mastra runtime


