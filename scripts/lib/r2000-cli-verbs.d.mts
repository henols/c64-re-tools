// Type declarations for r2000-cli-verbs.mjs, so the colocated test
// (.claude/mcp/vice/r2000-verb-coverage.test.ts) typechecks under strict
// mode. This file is a CI-only helper with no runtime role, so it stays
// out of .claude/mcp/vice/package.json's files[] like its .mjs sibling.
export declare const R2000_CLI_VERB_FLOOR: number;
export declare function parseR2000CliVerbs(src: string): string[];
export declare function verbsMissingFromSkills(verbs: string[], skillTexts: string[]): string[];
