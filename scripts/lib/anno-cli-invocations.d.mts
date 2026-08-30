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
// The per-verb declaration TABLES are declared here as well, since 2026-08-30
// (WR-01, and FLAG_KINDS since WR-18). They moved into the .mjs from the gate
// script, which runs its check at import time; the committed test now imports
// the shipped tables instead of keeping a private copy that could drift from
// the ones CI runs. A table added to the .mjs without a declaration here is a
// table the test cannot import.

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

/** The file kinds each verb's value-taking FLAGS may name (WR-18). Keyed verb
 * first, then flag. An empty object is a deliberate entry for a verb with no
 * value-taking flag; an absent key is not. A flag with no entry is one this
 * table makes no claim about -- the booleans, and `--sample N`. */
export declare const FLAG_KINDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

/** The declared order `checkInvocation()` reports problems in. `unknown-verb`
 * short-circuits and is returned alone. */
export declare const PROBLEM_ORDER: readonly string[];

/** Returns every documented invocation in `text`, or `null` -- never an empty
 * array -- when `text` contains no fenced code block at all. */
export declare function parseDocumentedInvocations(text: string): DocumentedInvocation[] | null;

/** Returns the human-readable problems with one invocation; empty when sound.
 *
 * `requiredFlags` and `flagKinds` are both declared REQUIRED, not optional,
 * deliberately: a caller that forgets a table must fail to compile rather than
 * silently skip the check that table exists to drive (WR-01's presence check
 * and WR-18's value checks respectively). Making either optional to spare a
 * call site would remove the check this declaration is here to enforce --
 * measured on 2026-08-30, adding the fifth parameter here and nowhere else
 * emits `TS2554: Expected 5 arguments, but got 4` at every call site in the
 * proof test, so the sentence above is a gate rather than a hope. */
export declare function checkInvocation(
  invocation: DocumentedInvocation,
  verbOptions: Readonly<Record<string, readonly string[]>>,
  positionalKinds: Readonly<Record<string, readonly string[]>>,
  requiredFlags: Readonly<Record<string, readonly string[]>>,
  flagKinds: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>,
): string[];
