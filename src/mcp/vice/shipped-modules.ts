// shipped-modules.ts
//
// The ONE place holding the `files[]`-derived shipped-module enumerator that
// every structural guard in this directory scans with, and the ONE full
// comment-AND-string-literal stripper those guards feed source text through
// before matching anything.
//
// WHY THIS FILE EXISTS (SEAM-02): `shippedTsModules()` existed as FOUR hand
// copies with identical FILTER logic -- in `docs-dangling-refs.test.ts` (the
// canonical body, and where the existence-assertion lesson was first
// recorded), `spawn-seam.test.ts`, `stock-dispatch.test.ts` and
// `comment-phase-pointers.test.ts`. Not byte-identical, and the difference is
// the point (IN-05): all four checked disk presence with
// `assert.ok(existsSync(...), ...)`, a SOFT assertion borrowed from whichever
// assertion library the calling test happened to import. The extraction
// throws its own `ShippedFilesEntryMissingError` instead -- a deliberate
// assert-to-throw upgrade, argued for further down: no call site can opt out
// of the check by forgetting an argument. Each copy decides WHAT its guard
// scans.
// One copy losing its existence assertion, or gaining a narrower extension
// filter, silently shrinks that guard's scanned set -- and the guard keeps
// PASSING, because a guard that scans nothing finds nothing. Four
// independently-editable definitions of "what we scan" is the divergence
// hazard the single-seam convention exists to remove, and it is invisible to
// every test in the tree because every copy is currently correct.
//
// `codeOnly()` is here for a DIFFERENT reason, and the distinction matters to
// anyone reading this file later looking for the divergence that motivated its
// sibling: there is no divergence hazard for the stripper worth speaking of --
// it had one full-strength consuming file. It is here on a SURVIVAL rationale.
// Its only home was an `anno-*.test.ts` file that a later prefix deletion
// removes, and it is the only implementation in this tree that correctly
// blanks TEMPLATE-LITERAL bodies -- logic that was measured into existence
// after a regex extractor was observed to MISS a real violation sitting inside
// a template literal. Without this move, the tree's only correct
// template-literal-aware stripper leaves with that file.
//
// WHAT `codeOnly()` HANDLES, STATED AS A MEASUREMENT RATHER THAN A CLAIM
// (WR-02, phase 27): `//` and `/* */` comments; all three literal shapes;
// nested `${ ... }` interpolation to any depth; escapes inside any of them;
// and regular-expression literals, disambiguated from division by the
// preceding significant token. The regex branch is NOT original to the
// extraction -- it was absent from every prior copy, and its absence was
// measured on this tree as a truncation, not reasoned about: a regex body
// containing a backtick or a quote opened a phantom literal frame the
// scanner never left, cutting `anno-coverage.ts` (whose `:1495` does
// `.replace(/[`*_]/g, "")`) from 2329 lines to 1107 and `incident-record.ts`
// (whose `:107` does `/'/g`) from 443 to 89 -- hiding seven real exported
// functions from the ANNO-01 spawn-seam guard reading them. That is the
// same "a guard that scans nothing finds nothing" failure the enumerator
// half of this file exists to remove, so BOTH halves of this module now
// carry it. `shipped-modules.test.ts` pins the regex shapes, the
// division-versus-regex disambiguation in both directions, and the two real
// modules by name.
//
// NOT handled, deliberately and known: JSX, and a `/` in the small set of
// positions where the preceding-token heuristic is ambiguous even for a real
// parser (after `)` or `}` closing a control-flow head, e.g.
// `if (x) /re/.test(y)`). Both are read as division. Neither shape occurs in
// this tree; a scanner that needed them would need a real tokeniser, not a
// wider heuristic.
//
// TEST-ONLY, both helpers. This module must never appear in `package.json`'s
// `files[]` (a test-only helper has no business in the published npm tarball)
// and must never be imported by a production module -- only by `*.test.ts`
// files. `shipped-modules.test.ts` asserts the `files[]` absence mechanically,
// so the rule is a red gate rather than a promise.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files and must never be collected as one. Separately and
// for an independent reason, it is a plain `.ts` and never a `.test.ts`:
// importing a `.test.ts` module for its exports also re-runs every top-level
// `test(...)` call that module registers with the runner, as an import side
// effect, silently duplicating that file's whole execution inside whichever
// file imports it. `acme-gate.ts` and `acme-verify.ts` state both
// rules for themselves; this module is the third instance of the same shape.
//
// WHAT NOT TO DO
//   - Never add a fifth hand copy of the enumerator anywhere. Import it.
//   - Never remove or weaken the existence check. A `files[]` entry that does
//     not exist on disk MUST throw. Returning a short list quietly narrows
//     every consuming guard at once and every one of them still passes.
//   - Never simplify `codeOnly()` into a regex or a line filter. It is a
//     character state machine because a regex was measured to miss a real
//     violation hidden in a template literal.
//   - Never fold the comment-BLANKING family in here beyond `codeOnly()`
//     above. Five sites do deliberately DIFFERENT jobs and are out of this
//     seam's scope by decision, not by oversight:
//       * `disasm-decoder.test.ts:308` -- local comment-line const
//       * `disasm-renderer.test.ts:346` -- byte-identical sibling of it
//       * `disasm-opcodes.test.ts:394`  -- byte-identical sibling of it
//       * `anno-tools.test.ts:201`     -- regex variant, and the file whose
//         lines 193-201 state IN CODE why comment-only stripping is the right
//         tool when the literal being searched for is itself a string
//       * `stock-dispatch.test.ts`'s `nonCommentLines()` -- line-oriented on
//         purpose, for exactly that reason
//     Blanking string bodies would make the literals those five search for
//     unobservable. Consolidating them would delete a measured decision.
//   - `extractCommentSpans()`/`CommentSpan` below are the ONE exception to
//     the point above: a comment-COLLECTING extractor (the inverse job --
//     capturing comment text rather than blanking it) that used to be
//     duplicated in `comment-phase-pointers.test.ts` is now defined here
//     once and imported there. `hop-chain-comments.test.ts` still carries
//     its OWN separate comment-collecting copy and is deliberately left
//     alone: consolidating a third caller was out of scope for the work that
//     moved the first two, and doing so without re-measuring that file's own
//     assertions would be exactly the kind of drive-by widening this
//     project's own review discipline rejects elsewhere. A future
//     consolidation of that copy needs its own read-first pass over that
//     file, not a fold-in here as a side effect.
//   - Never import a host/container path-translation module here, and never
//     add an assumption-log label token: both are grepped for mechanically.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Thrown when `files[]` names a `.ts`/`.mts` entry that is not on disk.
 * Named rather than anonymous so a caller's failure output says WHICH
 * invariant broke: the scanned set was about to shrink. */
export class ShippedFilesEntryMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippedFilesEntryMissingError";
  }
}

/** The shipped module set every structural guard scans: every
 * `package.json` `files[]` entry ending `.ts`/`.mts` -- the SHIPPED
 * production module set, DERIVED rather than enumerated, so a module a
 * later plan adds to `files[]` is scanned automatically with no edit in any
 * guard.
 *
 * Deliberately NOT a raw `readdirSync` over every non-`*.test.*` file in
 * this directory. That broader set also catches genuinely test-only helpers
 * that merely fail to end in `.test.ts` by name, and there are now TWO
 * modules of exactly that shape, not one special case: `anno-test-gate.ts`
 * (its own header states it is test-only and must never be imported by a
 * production module, and it is deliberately absent from `files[]`) probes
 * the external analyser's availability with a fixed, hardcoded argv; and
 * `acme-gate.ts` probes the ACME cross-assembler the same way, under the
 * same test-only rule. Both are real child-process call sites that no
 * shipped-surface guard is about, and neither is a file a maintainer ships.
 * Scanning `files[]` instead of the directory listing is what keeps both
 * probes out of every guard's discovered set WITHOUT an exclusion list --
 * "derive, don't enumerate" applied one level up, to WHICH set is scanned
 * rather than only to HOW it is scanned.
 *
 * A `files[]` entry that does not exist on disk THROWS rather than letting
 * the scanned set silently shrink. That is the point of this function, not
 * a nicety: without it a stale entry makes every consuming guard scan a
 * quietly shorter set and pass. It throws its own named error instead of
 * taking a caller's assertion library, so no call site can opt out of the
 * check by forgetting an argument.
 *
 * `dir` exists so this exact code path can be driven against a synthetic
 * `package.json`, which is how `shipped-modules.test.ts` plants a stale
 * entry without touching the real array. Real callers pass nothing. */
export function shippedTsModules(dir: string = HERE): string[] {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    if (!existsSync(join(dir, entry))) {
      throw new ShippedFilesEntryMissingError(
        `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
      );
    }
  }
  return entries;
}

/** The keywords after which a `/` starts a regular-expression literal rather
 * than a division operator. Needed because a previous-CHARACTER test alone
 * cannot tell `return /re/.test(x)` (a regex) from `total / count` (a
 * division): both are preceded by an identifier character. Every entry is a
 * keyword that can legally be followed by an expression. Getting this wrong
 * in the permissive direction is the dangerous one -- misreading a division
 * as a regex opener consumes real code as literal text -- which is why the
 * scanner below also refuses to treat an unterminated `/ ... EOL` run as a
 * regex at all. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

/** Strip comments AND (unless `keepLiteralBodies`) string/template-literal
 * bodies from TypeScript source, so a structural guard's pattern can only
 * ever match REAL code.
 *
 * Real code -- including any `${ ... }` interpolation inside a template
 * literal -- is preserved verbatim; comment text and quoted-literal text are
 * dropped entirely. This is deliberately a superset of the comment-only
 * strippers elsewhere in this directory: that is not enough for a guard whose
 * own headers discuss the forbidden shape in prose AND whose decoys include
 * string literals that merely QUOTE the forbidden shape as text.
 *
 * `keepLiteralBodies` exists for the one caller shape that needs the opposite:
 * an import-specifier assertion, where the thing being read IS a string, so
 * blanking literal bodies would make it unobservable. Default `false` keeps
 * the strict behaviour, so a module name appearing in a comment or a message
 * string still cannot satisfy a code check. */
export function codeOnly(src: string, keepLiteralBodies = false): string {
  const out: string[] = [];
  const n = src.length;
  let i = 0;
  const templateStack: { inInterp: boolean; interpBraceDepth: number }[] = [];

  // Expression-position tracking, for the regular-expression-literal branch
  // below. `/` is ambiguous in JS/TS -- it opens a regex literal in
  // expression position and is the division operator everywhere else -- and
  // only the preceding significant token can tell the two apart.
  let regexAllowed = true; // start-of-file IS expression position
  let prevWord = "";
  let prevWordIsProperty = false;

  /** Record one emitted code character's effect on expression position. */
  const noteCodeChar = (ch: string): void => {
    if (/\s/.test(ch)) return; // whitespace does not move expression position
    if (/[A-Za-z0-9_$]/.test(ch)) {
      prevWord += ch;
      // `obj.in` is a property access, not the `in` keyword, so a word that
      // began immediately after a `.` never counts as a regex-preceding one.
      regexAllowed = !prevWordIsProperty && REGEX_PRECEDING_KEYWORDS.has(prevWord);
      return;
    }
    prevWord = "";
    prevWordIsProperty = ch === ".";
    // `)`, `]` and `}` close a value-producing expression, so a following `/`
    // is division. Every other punctuator leaves us in expression position.
    regexAllowed = !/[)\]}]/.test(ch);
  };

  /** Record that a complete literal (string, template or regex) was just
   * consumed: a value was produced, so a following `/` is division. */
  const noteLiteralConsumed = (): void => {
    prevWord = "";
    prevWordIsProperty = false;
    regexAllowed = false;
  };

  /** Record the start of a fresh expression (a `${` interpolation opening). */
  const noteExpressionStart = (): void => {
    prevWord = "";
    prevWordIsProperty = false;
    regexAllowed = true;
  };

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;
    // Derived fresh from `templateStack` every iteration and carrying no
    // state across iterations, so both are loop-body consts (IN-01).
    const inTemplateText = top !== undefined && !top.inInterp;
    const inInterp = top !== undefined && top.inInterp;

    if (inTemplateText) {
      if (c === "\\") {
        if (keepLiteralBodies) out.push(src.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (c === "`") {
        templateStack.pop();
        if (keepLiteralBodies) out.push(c);
        noteLiteralConsumed();
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top!.inInterp = true;
        top!.interpBraceDepth = 1;
        if (keepLiteralBodies) out.push("${");
        noteExpressionStart();
        i += 2;
        continue;
      }
      if (keepLiteralBodies) out.push(c);
      i++; // drop template literal text
      continue;
    }

    // Top-level code, or inside a template literal's `${ ... }`
    // interpolation -- both are real code and both get the same handling
    // below (comments/quoted-literals/nested-templates), only the
    // interpolation-close bookkeeping differs.
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // A regular-expression literal. This branch MUST sit after the two
    // comment branches (`//` and `/*` are not regexes) and before the quote
    // and backtick branches: a regex body may legally contain `\'`, `"` or a
    // backtick, and without this branch such a character opens a phantom
    // string/template frame the scanner never leaves -- silently truncating
    // the rest of the file out of the "code" every consuming guard matches
    // against. Measured, not hypothetical: `anno-coverage.ts:1495`
    // (`.replace(/[`*_]/g, "")`) truncated a 2329-line module to 1107 lines
    // of visible code, and `incident-record.ts:107` (`/'/g`) truncated 443
    // lines to 89, hiding seven real exported functions from
    // `spawn-seam.test.ts`'s ANNO-01 scan.
    if (c === "/" && regexAllowed) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const d = src[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        // An unterminated run to end-of-line is not a regex literal. Bailing
        // here is what keeps a misclassified division (`a.in / 2`) from
        // eating the remainder of the file -- the same failure this branch
        // exists to remove, in the opposite direction.
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < n && /[dgimsuvy]/.test(src[j]!)) j++; // flags
        out.push(src.slice(i, j)); // a regex IS real code, in BOTH modes
        noteLiteralConsumed();
        i = j;
        continue;
      }
      // Not a regex after all -- fall through and treat `/` as an ordinary
      // code character.
    }
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        i++;
      }
      i++; // skip closing quote
      if (keepLiteralBodies) out.push(src.slice(start, i));
      noteLiteralConsumed();
      continue; // otherwise the entire quoted literal contributes nothing to "code"
    }
    if (c === "`") {
      templateStack.push({ inInterp: false, interpBraceDepth: 0 });
      if (keepLiteralBodies) out.push(c);
      i++;
      continue;
    }
    if (inInterp) {
      if (c === "{") {
        top!.interpBraceDepth++;
        out.push(c);
        noteCodeChar(c);
        i++;
        continue;
      }
      if (c === "}") {
        top!.interpBraceDepth--;
        i++;
        if (top!.interpBraceDepth === 0) {
          top!.inInterp = false;
          if (keepLiteralBodies) out.push(c);
        } else {
          out.push(c);
          noteCodeChar(c);
        }
        continue;
      }
    }
    out.push(c);
    noteCodeChar(c);
    i++;
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// PHASE 51: the comment-span extractor and the four-source shipped-surface
// enumerator. Both moved here for the same "single seam" reason as the two
// exports above: each had exactly one correct implementation scattered
// across guard test files that must not import each other, and a plain
// module is the one place a guard test CAN import from without re-running a
// sibling guard's tests as an import side effect.
// ---------------------------------------------------------------------------

/** Extensions worth reading as text -- everything a human or an agent reads
 * as prose or source, across every guard in this directory that walks a
 * directory tree. Moved here from `skills-planning-vocabulary.test.ts`
 * (its value is unchanged) so `shippedScanSurface()` below and that guard
 * share one definition instead of two that can drift apart. */
export const TEXT_EXTENSIONS = Object.freeze([".md", ".mjs", ".js", ".ts", ".mts", ".json", ".a", ".asm", ".txt"]);

/** One comment span: its exact source text (a `//` line or a block comment, including
 * the delimiters) and the character offset in the source it started at.
 * `startIndex` is what lets a caller map a span back to a physical line
 * number without re-scanning the file (see `comment-phase-pointers.test.ts`'s
 * `commentPhaseLines()`). Moved here, verbatim, from that same file -- this
 * is the seam both it and the comment-byte budget below now share. */
export interface CommentSpan {
  text: string;
  startIndex: number;
}

/** Captures every `//` line comment and every block comment span in `src`, walking
 * single/double-quoted strings and template literals (including nested
 * `${ ... }` interpolation) character-by-character to SKIP their bodies
 * correctly -- so a `//` or `/*` sequence sitting inside a string is never
 * mistaken for the start of a real comment. This is the inverse operation of
 * `codeOnly()` above: that function blanks comments and keeps code; this one
 * collects comment text and skips everything else. Moved here verbatim from
 * `comment-phase-pointers.test.ts`, which now imports it rather than
 * defining it a second time -- do not re-derive this state machine and do
 * not simplify it into a regex; both existing consumers (that guard's
 * per-line phase-mention scan, and `commentByteTotal()` below) depend on it
 * skipping string/template bodies exactly the way `codeOnly()`'s own header
 * explains was measured necessary. */
export function extractCommentSpans(src: string): CommentSpan[] {
  const spans: CommentSpan[] = [];
  const n = src.length;
  let i = 0;

  interface TemplateFrame {
    inInterp: boolean;
    interpBraceDepth: number;
  }
  const templateStack: TemplateFrame[] = [];

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;

    if (top && !top.inInterp) {
      // Inside a template literal's own text (not `${ }`) -- these
      // characters are literal content, never comment syntax, so just walk
      // through them watching for escapes, the closing backtick, and the
      // start of an interpolation.
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        templateStack.pop();
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top.inInterp = true;
        top.interpBraceDepth = 1;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Top-level code, OR inside a template literal's `${ ... }`
    // interpolation (both scan for comments/strings/nested templates the
    // same way; only the brace-depth tracking below differs).
    if (c === "/" && src[i + 1] === "/") {
      const start = i;
      while (i < n && src[i] !== "\n") i++;
      spans.push({ text: src.slice(start, i), startIndex: start });
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      spans.push({ text: src.slice(start, Math.min(i, n)), startIndex: start });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        i++;
      }
      i++; // skip closing quote
      continue;
    }
    if (c === "`") {
      templateStack.push({ inInterp: false, interpBraceDepth: 0 });
      i++;
      continue;
    }
    if (top && top.inInterp) {
      if (c === "{") {
        top.interpBraceDepth++;
        i++;
        continue;
      }
      if (c === "}") {
        top.interpBraceDepth--;
        i++;
        if (top.interpBraceDepth === 0) top.inInterp = false;
        continue;
      }
    }
    i++;
  }
  return spans;
}

/** Sum of every comment span's character length in `src` -- a thin wrapper
 * over `extractCommentSpans()`, deliberately: it must not re-walk the
 * source itself, or this file would carry two independently-driftable
 * comment scanners. Uses JS string `.length` (UTF-16 code units) throughout,
 * matching how `scanForPlanningVocabulary()`'s own `match.length` already
 * measures citation characters -- both sides of the comment-byte budget's
 * inequality must use the same unit or the comparison is meaningless. */
export function commentByteTotal(src: string): number {
  let total = 0;
  for (const span of extractCommentSpans(src)) total += span.text.length;
  return total;
}

/** Directory names never walked into: `node_modules` (never shipped
 * content) and anything starting `zz-scratch` (scratch directories other
 * tests write into the real tree concurrently -- the same exclusion
 * `shippedSkillFiles()` used before this function replaced it). */
function isSkippedDirName(name: string): boolean {
  return name === "node_modules" || name.startsWith("zz-scratch");
}

/** Recursively walks `absDir`, returning every file matching
 * `TEXT_EXTENSIONS`, as a POSIX path relative to `repoRootAbs`. Shared by
 * every directory-shaped `files[]` entry and by the `src/skills/` source
 * below, so all four sources of `shippedScanSurface()` apply the identical
 * extension filter and the identical scratch/node_modules exclusion. */
function walkTextFilesUnder(absDir: string, repoRootAbs: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (isSkippedDirName(dirent.name)) continue;
        walk(full);
        continue;
      }
      if (TEXT_EXTENSIONS.some((ext) => dirent.name.endsWith(ext))) {
        out.push(relative(repoRootAbs, full).split(sep).join("/"));
      }
    }
  };
  walk(absDir);
  return out;
}

/** Expands one `package.json` `files[]` array: a directory entry is walked
 * recursively via `walkTextFilesUnder()`; a file entry is taken directly,
 * filtered to `TEXT_EXTENSIONS`. Any entry that does not exist on disk
 * throws the shared `ShippedFilesEntryMissingError` -- the same failure
 * shape `shippedTsModules()` above already established, so a stale entry
 * narrows the scanned surface loudly instead of silently. `skipEntry` is the
 * one named, content-derived exception this function accepts: the
 * generated `installer/skills/` mirror (see `shippedScanSurface()` below). */
function expandFilesArray(
  pkgDir: string,
  entries: readonly string[],
  repoRootAbs: string,
  skipEntry?: (entry: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const entry of entries) {
    if (skipEntry?.(entry)) continue;
    const abs = join(pkgDir, entry);
    if (!existsSync(abs)) {
      throw new ShippedFilesEntryMissingError(
        `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
      );
    }
    if (statSync(abs).isDirectory()) {
      out.push(...walkTextFilesUnder(abs, repoRootAbs));
    } else if (TEXT_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(relative(repoRootAbs, abs).split(sep).join("/"));
    }
  }
  return out;
}

/** The full shipped-plus-skills scan surface every planning-vocabulary
 * guard now walks: repo-relative, POSIX, sorted, deduplicated paths, unioned
 * from four sources.
 *
 *   1. `<root>/src/mcp/vice/package.json` `files[]`, expanded (directory
 *      entries walked recursively, file entries taken directly, both
 *      filtered to `TEXT_EXTENSIONS`) -- what `shippedTsModules()` above
 *      cannot do and must not be changed to do: that function filters to
 *      `.ts`/`.mts` only and returns directory entries as literal strings,
 *      which would silently drop `README.md`, `THIRD-PARTY-NOTICES.md`,
 *      `tools-manifest.stock.json` and the whole `resources/` directory.
 *   2. The host-bound sources behind the generated `resources/` artifacts:
 *      `HOST_BOUND_ARTIFACTS` (imported from `./build.ts`, never
 *      hand-listed) mapped from each `.mjs` name to its `.mts` sibling under
 *      `<root>/src/mcp/vice/`. Two of these are already reachable through
 *      source 1 and dedupe away there; the rest are what this source adds.
 *   3. `<root>/installer/package.json` `files[]`, expanded the same way,
 *      with `skills/` skipped -- a GENERATED MIRROR exclusion, not a
 *      by-path content exemption: `installer/scripts/sync-skills.mjs`
 *      regenerates it from source 4 below on every `npm pack`/`prepack`, it
 *      is gitignored and absent on a fresh clone and in CI, and every byte
 *      it would contain is already scanned at its source. No content
 *      escapes the scan.
 *   4. `<root>/src/skills/`, walked with the same exclusions and extension
 *      filter as every other source -- the skills tree's own coverage,
 *      preserved rather than replaced.
 *
 * `root` is a required parameter with no default, so this exact code path
 * is drivable against a synthetic tree (see `shipped-modules.test.ts`) and
 * so this function never bakes in a fixed `".."`. */
export function shippedScanSurface(root: string): string[] {
  const set = new Set<string>();

  const vicePkgDir = join(root, "src", "mcp", "vice");
  const vicePkg = JSON.parse(readFileSync(join(vicePkgDir, "package.json"), "utf8")) as { files?: string[] };
  for (const rel of expandFilesArray(vicePkgDir, vicePkg.files ?? [], root)) set.add(rel);

  for (const mjsName of HOST_BOUND_ARTIFACTS) {
    const mtsName = mjsName.replace(/\.mjs$/, ".mts");
    const abs = join(vicePkgDir, mtsName);
    if (!existsSync(abs)) {
      throw new ShippedFilesEntryMissingError(
        `HOST_BOUND_ARTIFACTS names ${mjsName} but its .mts source ${mtsName} does not exist on disk -- update HOST_BOUND_ARTIFACTS rather than letting the scanned set shrink silently`,
      );
    }
    set.add(relative(root, abs).split(sep).join("/"));
  }

  const installerDir = join(root, "installer");
  const installerPkg = JSON.parse(readFileSync(join(installerDir, "package.json"), "utf8")) as { files?: string[] };
  for (const rel of expandFilesArray(
    installerDir,
    installerPkg.files ?? [],
    root,
    (entry) => entry === "skills/" || entry === "skills",
  )) {
    set.add(rel);
  }

  const skillsDir = join(root, "src", "skills");
  for (const rel of walkTextFilesUnder(skillsDir, root)) set.add(rel);

  return [...set].sort();
}
