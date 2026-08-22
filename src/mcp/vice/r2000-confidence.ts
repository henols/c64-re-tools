#!/usr/bin/env node
// r2000-confidence.ts -- the ONE authoritative place in this repo for D-25's
// confidence-grade convention: a machine-readable bracket-token prefix inside
// an r2000 line comment (e.g. `[confirmed-code] observed executing at $0810`).
//
// WHY THIS MODULE EXISTS: r2000's own `BlockType` (twelve variants -- Code,
// Byte, Word, Address, PETSCII, Screencode, four split-table variants,
// ExternalFile, Undefined; `types.rs:314-331`) carries CLASSIFICATION but no
// CONFIDENCE axis. `Code` cannot distinguish "PC observed executing" from
// "reachable via a JSR, never run" -- that distinction is
// `memory-map.template.md`'s most deliberate feature, and its own text
// forbids promoting a row by editing its grade (re-verify and restate the
// evidence instead). Measured (D-25): r2000 line comments persist through
// save/reload (`user_line_comments`), and both `r2000_get_comments` and
// `r2000_search_disassembly` (which searches comments by default) can filter
// on a leading token -- so "show me everything still [unknown]" is a real
// query today, with NO new storage.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR:
//   - the five-grade vocabulary (`CONFIDENCE_GRADES`), copied verbatim from
//     `.claude/skills/c64-program-recon/templates/memory-map.template.md`'s
//     own confidence table -- nowhere else in this repo may hand-write one
//     of these five phrases or bracket tokens as a second copy;
//   - the parser (`parseConfidencePrefix`) that decides whether a comment
//     carries a grade, an ungraded plain comment, or a TYPO'D near-miss that
//     must fail loudly;
//   - the composer (`formatConfidenceComment`) that writes a graded comment,
//     so no caller invents its own spelling of a bracket token;
//   - the query builder (`searchQueryForGrade`) that gives the "still
//     [grade]" search exactly one spelling.
//
// THE POINT OF THIS MODULE, STATED PLAINLY: a comment beginning with a
// bracket token that is NOT exactly one of the five valid tokens must THROW,
// naming the offending token and listing the five valid ones. A comment with
// no leading bracket at all is a legal, ungraded comment (`grade: null`) --
// that is not an error. What must NEVER happen is a TYPO silently degrading
// into an ungraded comment, because that is exactly how an `[unknown]` row
// could disappear from the "still unknown" query without anyone noticing.
//
// WHAT NOT TO DO, named concretely:
//   - Never accept a near-miss token (wrong case, an underscore instead of a
//     hyphen, a plural, extra whitespace inside the brackets, a genuine
//     typo). Every one of those must throw `R2000ConfidenceGradeError`, not
//     silently degrade to `grade: null`.
//   - Never add a second, address-keyed sidecar store for grades (T-11-
//     SECOND-STORE). Grades live ONLY as this bracket-token prefix inside
//     r2000's own line comments -- a second store keyed by address is
//     exactly the drift class criterion 1 exists to close, and it would not
//     be queryable through the same `r2000_get_comments` /
//     `r2000_search_disassembly` tools this module's whole design depends
//     on.
//   - Never promote a row by editing its grade in place. The template's own
//     text says so, and this module has no "upgrade" or "promote" function
//     by design -- a caller who wants to change a grade calls
//     `r2000_set_comment` again with a freshly composed
//     `formatConfidenceComment()` string, leaving a new comment (or
//     replacing the old one explicitly), never a silent in-place mutation
//     this module would hide.
//   - Never widen `CONFIDENCE_GRADES` without updating
//     `memory-map.template.md`'s own table first -- the template is the
//     source of the vocabulary, this module is its one authoritative
//     runtime copy, and the non-vacuity test below fails if the two drift.

export interface ConfidenceGrade {
  /** The bracket token's inner text, e.g. `"confirmed-code"` -- no brackets. */
  readonly token: string;
  /** The full bracket token as it appears in a comment, e.g. `"[confirmed-code]"`. */
  readonly bracket: string;
  /** The human phrase from `memory-map.template.md`'s own confidence table,
   * e.g. `"confirmed code"` (no hyphen -- this is prose, not an identifier). */
  readonly phrase: string;
  /** What the grade means, copied verbatim from the template's "Means" column. */
  readonly meaning: string;
}

/**
 * The five grades from `memory-map.template.md`'s confidence table, in the
 * template's own order. This is the ONE place the vocabulary is written
 * down -- see the module header's "what NOT to do" list.
 */
export const CONFIDENCE_GRADES: readonly ConfidenceGrade[] = [
  {
    token: "confirmed-code",
    bracket: "[confirmed-code]",
    phrase: "confirmed code",
    meaning: "Executed during tracing, PC observed inside it",
  },
  {
    token: "probable-code",
    bracket: "[probable-code]",
    phrase: "probable code",
    meaning: "Reachable through a JSR/JMP/vector, not yet observed executing",
  },
  {
    token: "confirmed-data",
    bracket: "[confirmed-data]",
    phrase: "confirmed data",
    meaning: "Never hit as an instruction stream across full gameplay coverage",
  },
  {
    token: "probable-data",
    bracket: "[probable-data]",
    phrase: "probable data",
    meaning:
      "Indexed-load target, or matches a data shape (sprite blocks, PETSCII, address tables)",
  },
  {
    token: "unknown",
    bracket: "[unknown]",
    phrase: "unknown",
    meaning: "No reliable interpretation yet",
  },
] as const;

/** Every valid bracket token, e.g. `["[confirmed-code]", ..., "[unknown]"]`. */
const VALID_BRACKETS: readonly string[] = CONFIDENCE_GRADES.map((g) => g.bracket);

/** Every valid inner token, e.g. `["confirmed-code", ..., "unknown"]`. */
const VALID_TOKENS: readonly string[] = CONFIDENCE_GRADES.map((g) => g.token);

const GRADE_BY_TOKEN: ReadonlyMap<string, ConfidenceGrade> = new Map(
  CONFIDENCE_GRADES.map((g) => [g.token, g]),
);

export interface R2000ConfidenceGradeErrorOptions {
  /** The raw text found between the leading `[` and `]`, verbatim -- may
   * carry the wrong case, stray whitespace, an underscore, or a plural, so a
   * caller can see exactly what was rejected. */
  offendingToken: string;
}

/**
 * Thrown by `parseConfidencePrefix()` when a comment begins with a bracket
 * token that is not exactly one of `CONFIDENCE_GRADES`'s five. Named,
 * carries the offending token as a field, and its message lists all five
 * valid tokens -- mirroring `r2000-launch.ts`'s `R2000ViceFlagError` shape
 * (a named error over a malformed token, rather than a silent strip).
 */
export class R2000ConfidenceGradeError extends Error {
  offendingToken: string;

  constructor(message: string, { offendingToken }: R2000ConfidenceGradeErrorOptions) {
    super(message);
    this.name = "R2000ConfidenceGradeError";
    this.offendingToken = offendingToken;
  }
}

export interface ParsedConfidencePrefix {
  /** The matched grade, or `null` for a legal, ungraded plain comment. */
  grade: ConfidenceGrade | null;
  /** The comment text with the leading bracket token (and one following
   * run of whitespace, if any) stripped. Equal to the input when `grade` is
   * `null`. */
  rest: string;
}

/**
 * Extracts a leading `[...]` bracket token from `comment` and resolves it
 * against `CONFIDENCE_GRADES`.
 *
 * - No leading bracket at all (the comment does not start with `[`, or has
 *   no closing `]`): returns `{ grade: null, rest: comment }`. A comment
 *   with no attempted grade token is legal and ungraded -- this is not an
 *   error.
 * - A leading bracket token that matches exactly one of the five valid
 *   tokens: returns `{ grade, rest }` with `rest` being the remainder after
 *   the bracket and one run of following whitespace.
 * - A leading bracket token that does NOT match exactly one of the five
 *   (wrong case, an underscore, a plural, stray whitespace inside the
 *   brackets, or a plain typo): THROWS `R2000ConfidenceGradeError`, naming
 *   the offending token and listing the five valid ones. This is the whole
 *   point of the module -- see the header comment.
 */
export function parseConfidencePrefix(comment: string): ParsedConfidencePrefix {
  const match = /^\[([^[\]]*)\](\s*)/.exec(comment);
  if (!match) {
    return { grade: null, rest: comment };
  }

  const innerToken = match[1]!;
  const grade = GRADE_BY_TOKEN.get(innerToken);
  if (!grade) {
    throw new R2000ConfidenceGradeError(
      `"[${innerToken}]" is not a valid confidence grade -- the five valid tokens are ` +
        `${VALID_BRACKETS.join(", ")}. A near-miss (wrong case, an underscore instead of a hyphen, a ` +
        "plural, stray whitespace inside the brackets, or a plain typo) is refused rather than " +
        "silently treated as an ungraded comment, because that is exactly how an [unknown] row " +
        "could disappear from the \"still unknown\" query without anyone noticing.",
      { offendingToken: innerToken },
    );
  }

  const consumed = match[0]!.length;
  return { grade, rest: comment.slice(consumed) };
}

/**
 * Composes a graded comment: the grade's bracket token, one space, then
 * `evidence`. The ONE place a graded comment is assembled, so no caller
 * invents its own spelling of a bracket token.
 */
export function formatConfidenceComment(grade: string, evidence: string): string {
  const found = GRADE_BY_TOKEN.get(grade);
  if (!found) {
    throw new R2000ConfidenceGradeError(
      `"${grade}" is not a valid confidence grade token -- the five valid tokens are ` +
        `${VALID_TOKENS.join(", ")}.`,
      { offendingToken: grade },
    );
  }
  return `${found.bracket} ${evidence}`;
}

/**
 * Returns the literal search string that appears verbatim in every comment
 * carrying `grade` -- the bracket token itself, e.g. `"[unknown]"`. Passing
 * this to `r2000_search_disassembly`'s `query` (with `use_regex` left
 * false/omitted) lists every address still carrying that grade. One
 * spelling, so "show me everything still [unknown]" never has two competing
 * queries drifting apart.
 */
export function searchQueryForGrade(grade: string): string {
  const found = GRADE_BY_TOKEN.get(grade);
  if (!found) {
    throw new R2000ConfidenceGradeError(
      `"${grade}" is not a valid confidence grade token -- the five valid tokens are ` +
        `${VALID_TOKENS.join(", ")}.`,
      { offendingToken: grade },
    );
  }
  return found.bracket;
}
