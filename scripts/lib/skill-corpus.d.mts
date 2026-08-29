// Type declarations for skill-corpus.mjs, so a colocated test that imports
// it (src/mcp/vice/skill-attribution.test.ts, Phase 19/ABS-02) typechecks
// under strict mode -- the same shape scripts/lib/skill-honesty-checks.d.mts
// and scripts/lib/anno-cli-verbs.d.mts already establish. This file is a
// CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling.
export declare function walkSkills(dir: string): string[];
export declare function extractToolNames(text: string): string[];
export declare function topLevelSkillDirs(dir: string): string[];
export declare const MCP_PREFIX_RE: RegExp;
export declare const TOOL_NAME_RE: RegExp;
