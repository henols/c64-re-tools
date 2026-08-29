// Type declarations for anno-cli-verbs.mjs, so the colocated test
// (src/mcp/vice/anno-verb-coverage.test.ts) typechecks under strict
// mode. This file is a CI-only helper with no runtime role, so it stays
// out of src/mcp/vice/package.json's files[] like its .mjs sibling.
export declare const ANNO_CLI_VERB_FLOOR: number;
export declare function parseAnnoCliVerbs(src: string): string[];
export declare function verbsMissingFromSkills(verbs: string[], skillTexts: string[]): string[];
