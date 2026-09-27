# References for Single-Capability Skills

## Similar Implementations

### The pattern skill

- **Location:** `skills/c64-petcat/` (becomes `skills/c64-basic/`)
- **Relevance:** one capability, one script, one binary behind the host-tool
  seam, and a "What this skill does NOT do" section that names the
  boundary.
- **Key patterns:** a short intro with the script bound to a variable, task
  sections in the order the work happens, then Failure shape and NOT do.

### Sibling loading

- **Location:** `skills/*/scripts/sibling.ts` (`loadSibling`, `siblingOrRefuse`),
  `test/skills/sibling.test.ts`
- **Relevance:** the mechanism every consumer uses to reach the shared
  modules. Only `SIBLING_SKILL`, the hint and the import specifiers change.

### MCP module resolution

- **Location:** `skills/c64-ram-capture/scripts/mcp-module.ts`
  (`resolveMcpModule`, `invokeHostTool`), which moves to `skills/c64-project/`
- **Relevance:** the disassembler script resolves `ghidra-run` and
  `dxa-run` through the same ladder, and rung 3 maps `x.ts` to `dist/x.js`.

### Ghidra and dxa orchestration

- **Location:** `src/mcp/vice/ghidra-run.ts` (`runGhidraAnalyze`,
  `classifyGhidraRunLog`), `src/mcp/vice/dxa-run.ts` (`runDxaDisassemble`)
- **Relevance:** the client-side orchestration already exists. This spec
  adds the CLI entry and ships both in `dist/` through `SERVER_ROOTS` in
  `build.ts`.
