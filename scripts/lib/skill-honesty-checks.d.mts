// Type declarations for skill-honesty-checks.mjs, so the colocated test
// (.claude/mcp/vice/skill-honesty-checks.test.ts) typechecks under strict
// mode. This file is a CI-only helper with no runtime role, so it stays
// out of .claude/mcp/vice/package.json's files[] like its .mjs sibling.
export declare function fileClaimViolations(
  content: string,
  spec: { forbidden?: string[]; required?: string[] }
): string[];
export declare function isStandaloneDisasmToken(line: string): boolean;
