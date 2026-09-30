## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships an MCP server, a
broker and reverse-engineering skills. The skills install with the `skills`
CLI (`npx skills add henols/c64-re-tools`) straight from this repo; the MCP server
and broker ship as the npm package `@henols/vice-mcp` and in the Claude Code plugin.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

## Technology Stack

### Languages
- TypeScript (the only language for new code; see `agent-os/product/tech-stack.md`)
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`) and the dxa build script
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `skills/c64-assembler/template.a`
- Markdown - all skill documentation (`SKILL.md` files)

### Runtime
- Node.js ≥ 24 for the MCP server (`@henols/vice-mcp`) and for the skill scripts.

### Key runtime dependencies
- `@mastra/mcp` - MCP server/tooling framework
- `@mastra/core` - underlying Mastra runtime
- `@modelcontextprotocol/sdk` - MCP protocol types and client, imported directly by `vice-proxy.ts`
