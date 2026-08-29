// Type declarations for the removal gate (`scripts/check-no-<subject>.mjs`),
// so its colocated test (src/mcp/vice/removal-gate.test.ts) typechecks under
// strict mode. This is a CI-only helper with no runtime role, so it stays out
// of src/mcp/vice/package.json's files[] like its .mjs sibling -- the same
// arrangement scripts/lib/r2000-cli-verbs.d.mts already uses.
export declare const SUBJECT_NEEDLE: string;
export declare function subjectHits(relPath: string, text: string): number[];
export interface NoticesBlock {
  firstLine: number;
  lastLine: number;
  text: string;
}
export declare function attributionBlocks(text: string): NoticesBlock[];
export declare function isInsideAttributionBlock(text: string, line: number): boolean;
