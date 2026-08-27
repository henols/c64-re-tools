// shipped-modules.ts
//
// The ONE place holding the `files[]`-derived shipped-module enumerator that
// every structural guard in this directory scans with, and the ONE full
// comment-AND-string-literal stripper those guards feed source text through
// before matching anything.
//
// WHY THIS FILE EXISTS (SEAM-02): `shippedTsModules()` existed as FOUR
// byte-identical hand copies -- in `docs-dangling-refs.test.ts` (the
// canonical body, and where the existence-assertion lesson was first
// recorded), `r2000-spawn-seam.test.ts`, `stock-dispatch.test.ts` and
// `comment-phase-pointers.test.ts`. Each copy decides WHAT its guard scans.
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
// Its only home was an `r2000-*.test.ts` file that a later prefix deletion
// removes, and it is the only implementation in this tree that correctly
// blanks TEMPLATE-LITERAL bodies -- logic that was measured into existence
// after a regex extractor was observed to MISS a real violation sitting inside
// a template literal. Without this move, the tree's only correct
// template-literal-aware stripper leaves with that file.
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
// file imports it. `fork-deleted-tools.ts` and `r2000-test-gate.ts` state both
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
//   - Never fold the comment-extractor family in here. Six sites do
//     deliberately DIFFERENT jobs and are out of this seam's scope by
//     decision, not by oversight:
//       * `disasm-decoder.test.ts:308` -- local comment-line const
//       * `disasm-renderer.test.ts:346` -- byte-identical sibling of it
//       * `disasm-opcodes.test.ts:394`  -- byte-identical sibling of it
//       * `r2000-tools.test.ts:201`     -- regex variant, and the file whose
//         lines 193-201 state IN CODE why comment-only stripping is the right
//         tool when the literal being searched for is itself a string
//       * `stock-dispatch.test.ts`'s `nonCommentLines()` -- line-oriented on
//         purpose, for exactly that reason
//       * `hop-chain-comments.test.ts`'s comment-span extractor -- collects
//         comment text rather than blanking it, the inverse operation
//     Blanking string bodies would make the literals those five search for
//     unobservable. Consolidating them would delete a measured decision.
//   - Never import a host/container path-translation module here, and never
//     add an assumption-log label token: both are grepped for mechanically.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
 * modules of exactly that shape, not one special case: `r2000-test-gate.ts`
 * (its own header states it is test-only and must never be imported by a
 * production module, and it is deliberately absent from `files[]`) probes
 * regenerator2000's availability with a fixed, hardcoded argv; and
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
  let inTemplateText = false;
  let inInterp = false;
  const templateStack: { inInterp: boolean; interpBraceDepth: number }[] = [];

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;
    inTemplateText = top !== undefined && !top.inInterp;
    inInterp = top !== undefined && top.inInterp;

    if (inTemplateText) {
      if (c === "\\") {
        if (keepLiteralBodies) out.push(src.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (c === "`") {
        templateStack.pop();
        if (keepLiteralBodies) out.push(c);
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top!.inInterp = true;
        top!.interpBraceDepth = 1;
        if (keepLiteralBodies) out.push("${");
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
        }
        continue;
      }
    }
    out.push(c);
    i++;
  }
  return out.join("");
}
