// Type declarations for audit-root.mjs, so the colocated tests
// (src/mcp/vice/guard-fates.test.ts, src/mcp/vice/audit-root-args.test.ts)
// typecheck under strict mode. This file is a CI-only helper with no runtime
// role, so it stays out of src/mcp/vice/package.json's files[] like its .mjs
// sibling.

export declare function resolveContainedRoot(
  rootArg: string | undefined | null,
  options: { repoRoot: string; allowExtra?: string[] },
): string;

/** Strict argv reader for the `--root` flag. Throws on EVERY malformed form
 *  rather than falling back to the default root; see the .mjs sibling's
 *  "THE ARGV SEAM" block for why each form is an error. */
export declare function parseRootArg(
  argv: string[],
  options: { script: string; booleanFlags?: string[] },
): { root: string | undefined; flags: Record<string, boolean> };
