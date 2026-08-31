// Type declarations for audit-root.mjs, so the colocated test
// (src/mcp/vice/guard-fates.test.ts) typechecks under strict mode. This file is
// a CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling.

export declare function resolveContainedRoot(
  rootArg: string | undefined | null,
  options: { repoRoot: string; allowExtra?: string[] },
): string;
