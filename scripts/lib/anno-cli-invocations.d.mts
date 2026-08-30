// Type declarations for anno-cli-invocations.mjs, so the colocated test
// (src/mcp/vice/anno-cli-invocations.test.ts) typechecks under strict mode.
// This file is a CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling.
//
// The shape below is the ONE declaration of what an extracted invocation is;
// if the parser's return shape changes and this file does not, every assertion
// in the proof test stops compiling, which is the behaviour a proof wants.
// Measured on 2026-08-30: adding `checkInvocation`'s fourth parameter here and
// nowhere else makes `tsc --noEmit` emit `TS2554: Expected 4 arguments, but
// got 3` at every call site in that test, so the declaration is genuinely in
// the typecheck program and the sentence above is a gate rather than a hope.
//
// The two per-verb declaration TABLES are declared here as well, since
// 2026-08-30 (WR-01). They moved into the .mjs from the gate script, which
// runs its check at import time; the committed test now imports the shipped
// tables instead of keeping a private copy that could drift from the ones CI
// runs. A table added to the .mjs without a declaration here is a table the
// test cannot import.

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

/** The file kinds each verb's positional slot may name. */
export declare const POSITIONAL_KINDS: Readonly<Record<string, readonly string[]>>;

/** The flags each verb REQUIRES, read off the CLI's own refusal branches. An
 * empty array is a deliberate entry; an absent key is not. */
export declare const REQUIRED_FLAGS: Readonly<Record<string, readonly string[]>>;

/** The declared order `checkInvocation()` reports problems in. `unknown-verb`
 * short-circuits and is returned alone. */
export declare const PROBLEM_ORDER: readonly string[];

/** Returns every documented invocation in `text`, or `null` -- never an empty
 * array -- when `text` contains no fenced code block at all. */
export declare function parseDocumentedInvocations(text: string): DocumentedInvocation[] | null;

/** Returns the human-readable problems with one invocation; empty when sound.
 *
 * `requiredFlags` is declared REQUIRED, not optional, deliberately: a caller
 * that forgets the table must fail to compile rather than silently skip the
 * presence check WR-01 exists to add. Making it optional to spare a call site
 * would remove the check this declaration is here to enforce. */
export declare function checkInvocation(
  invocation: DocumentedInvocation,
  verbOptions: Readonly<Record<string, readonly string[]>>,
  positionalKinds: Readonly<Record<string, readonly string[]>>,
  requiredFlags: Readonly<Record<string, readonly string[]>>,
): string[];
