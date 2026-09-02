// Type declarations for audit-root.mjs, so the colocated test
// (src/mcp/vice/audit-root-args.test.ts) typechecks under strict mode. This file is a CI-only helper with no runtime
// role, so it stays out of src/mcp/vice/package.json's files[] like its .mjs
// sibling.

export declare function resolveContainedRoot(
  rootArg: string | undefined | null,
  options: { repoRoot: string },
): string;

/** Strict argv reader for the `--root` flag and any flags the caller declares.
 *  Throws on EVERY malformed form rather than falling back to the default
 *  root; see the .mjs sibling's "THE ARGV SEAM" block for why each form is an
 *  error. `booleanFlags` and `valueFlags` are supplied in code, never from
 *  argv, and a token declared in both is a caller error rather than a
 *  `BAD ARGUMENTS --` rejection. `values` is keyed by the flag token exactly
 *  as declared, matching how `flags` keys `booleanFlags`. */
export declare function parseRootArg(
  argv: string[],
  options: { script: string; booleanFlags?: string[]; valueFlags?: string[] },
): {
  root: string | undefined;
  flags: Record<string, boolean>;
  values: Record<string, string>;
};
