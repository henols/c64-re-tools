// Type declarations for anno-cli-invocations.mjs, so the colocated test
// (src/mcp/vice/anno-cli-invocations.test.ts) typechecks under strict mode.
// This file is a CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling.
//
// The shape below is the ONE declaration of what an extracted invocation is;
// if the parser's return shape changes and this file does not, every assertion
// in the proof test stops compiling, which is the behaviour a proof wants.

/** One `--flag` and the token that followed it, or `null` for a flag with no
 * value (a boolean flag, or one at end of line). */
export interface DocumentedInvocationFlag {
  flag: string;
  value: string | null;
}

/** One documented `anno <verb> ...` invocation, extracted from a fenced code
 * block in a skill file. */
export interface DocumentedInvocation {
  verb: string;
  positionals: string[];
  flags: DocumentedInvocationFlag[];
  /** The trimmed source line, quoted back in a problem message so a failure
   * names the invocation a reader has to go and find. */
  raw: string;
}

export declare const ANNO_INVOCATION_FLOOR: number;

/** Returns every documented invocation in `text`, or `null` -- never an empty
 * array -- when `text` contains no fenced code block at all. */
export declare function parseDocumentedInvocations(text: string): DocumentedInvocation[] | null;

/** Returns the human-readable problems with one invocation; empty when sound. */
export declare function checkInvocation(
  invocation: DocumentedInvocation,
  verbOptions: Readonly<Record<string, readonly string[]>>,
  positionalKinds: Readonly<Record<string, readonly string[]>>,
): string[];
