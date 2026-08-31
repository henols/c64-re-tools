// scripts/lib/audit-root.mjs
//
// WHY THIS FILE EXISTS: the audit scripts in this directory tree take a
// `--root <dir>` flag as their ONLY testability seam -- there is deliberately
// no waiver file, no environment-variable override and no skip flag anywhere
// in them (the no-relaxation-hatch rule recorded in `scripts/audit-gate.mjs`'s
// header). A flag that decides which tree a script reads AND WRITES is a path
// argument crossing a trust boundary, so it needs exactly one containment
// check, in exactly one place, rather than a re-derived `startsWith` in each
// consumer.
//
// PROVENANCE CORRECTION (recorded so the next reader does not re-chase it):
// this phase's research document cited `scripts/audit-gate.mjs:1147-1151` as
// the containment check to copy. That citation is WRONG. The code there is the
// WR-03 try/catch that turns a MISTYPED `--root` into a diagnosable failure
// instead of an uncaught ENOENT stack -- a different concern -- and there is
// no containment check anywhere in that file. This module was therefore
// written new rather than copied.
//
// WHAT NOT TO DO:
//  - Do not compare with a bare `startsWith`. `/repo-evil` starts with
//    `/repo`, so a bare prefix test accepts a SIBLING directory as "inside"
//    the root. The comparison below is segment-wise: equal to the base, or
//    prefixed by the base plus a path separator. `resolveContainedRoot`'s own
//    test drives exactly that sibling case.
//  - Do not add an "allow anything" escape (an env var, a `--unsafe-root`
//    flag, a magic value). `allowExtra` exists for the one legitimate case --
//    a caller that must also accept a directory outside the repository, e.g.
//    a system temp dir it created itself -- and every entry is supplied by the
//    CALLER in code, never by CLI argv, stdin or a file.
//  - Do not resolve symlinks here. This returns a lexically-resolved absolute
//    path, and callers use it as the base for their own joins; adding
//    `realpathSync` would make the function throw on a not-yet-created
//    directory, which several callers legitimately pass.

// PARSING VERSUS RESOLUTION, and why both live here:
// `resolveContainedRoot()` answers "is this value allowed to be the root?".
// `parseRootArg()` answers the question BEFORE it: "did the operator actually
// supply a root at all?". Those are two failure classes and they stay two
// functions, so a containment REFUSAL and an argv REJECTION can never blur
// into one another -- but they belong in ONE file, because the defect that
// motivated `parseRootArg()` was six consumers each answering the second
// question for themselves (IN-06).

import { isAbsolute, resolve, sep } from "node:path";

/**
 * True when `candidate` is `base` itself or a descendant of it, compared at a
 * path-segment boundary rather than by raw string prefix.
 */
function isContainedBy(candidate, base) {
  return candidate === base || candidate.startsWith(base + sep);
}

/**
 * Resolves a `--root` argument and REFUSES anything outside the repository.
 *
 * @param {string|undefined|null} rootArg  the raw CLI value; falsy means
 *        "use `repoRoot`", which is the normal, unflagged invocation.
 * @param {{ repoRoot: string, allowExtra?: string[] }} options
 *        `repoRoot` is the containing root (required, must be absolute).
 *        `allowExtra` is an optional list of additional containing roots,
 *        supplied in code by the caller, never from untrusted input.
 * @returns {string} the resolved, contained absolute path.
 * @throws {Error} when `rootArg` resolves outside every permitted root. The
 *         message names BOTH the offending resolved path and the containing
 *         root, so a refusal is never confusable with a typo failure.
 */
export function resolveContainedRoot(rootArg, { repoRoot, allowExtra = [] } = {}) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new Error(
      "resolveContainedRoot: `repoRoot` is required and must be a non-empty absolute path -- " +
        "without it there is nothing to contain the argument against, and a missing containing " +
        "root must never degrade into accepting any path.",
    );
  }
  if (!isAbsolute(repoRoot)) {
    throw new Error(
      `resolveContainedRoot: \`repoRoot\` must be absolute, got ${JSON.stringify(repoRoot)}. ` +
        "A relative containing root would make containment depend on the process cwd.",
    );
  }

  const base = resolve(repoRoot);
  const extras = allowExtra.map((p) => resolve(p));
  const resolved = resolve(base, rootArg == null || rootArg === "" ? "." : String(rootArg));

  if (isContainedBy(resolved, base)) return resolved;
  for (const extra of extras) if (isContainedBy(resolved, extra)) return resolved;

  const extraNote =
    extras.length > 0
      ? ` (nor inside any additionally-permitted root: ${extras.join(", ")})`
      : "";
  throw new Error(
    `--root ${JSON.stringify(String(rootArg))} resolves to ${resolved}, which is OUTSIDE the ` +
      `repository root ${base}${extraNote}. Refusing: this flag decides which tree the audit ` +
      "reads and writes, so it is contained to the repository by construction rather than by " +
      "convention. Note that a sibling directory whose name merely shares the root's prefix " +
      "(e.g. a `-evil` suffix) is refused here too -- the comparison is segment-wise.",
  );
}

// ---------------------------------------------------------------------------
// THE ARGV SEAM
// ---------------------------------------------------------------------------
//
// WHY THIS LIVES HERE RATHER THAN IN SIX CONSUMERS (IN-06): the reader this
// replaces was copy-pasted verbatim into six scripts. It matched only the
// exact token `--root` and took `argv[i + 1]` as its value, so `--root=<dir>`,
// a valueless `--root` and any typo were all SILENTLY DISCARDED -- the loop
// simply never fired and the invocation fell through to the default root. The
// same defect therefore shipped six times, and on the one consumer that
// WRITES it meant `--root=/tmp/definitely-not-here` overwrote the REAL
// `docs/tool-support.md` and exited 0 while printing success. A parser that
// guesses is what produced that, so this one never guesses: every malformed
// form is a hard, named error.
//
// The shape and the error style are taken from
// `scripts/audit-mutation-harness.mjs`'s reader -- the one copy that DID throw
// on an unrecognised token and printed a usage line with it. That is the model
// that was not reused; it is reused here.
//
// WHAT NOT TO DO:
//  - Do not add a permissive mode. No env var, no `--lenient`, no "warn and
//    continue" branch, no allow-list of tolerated typos. The no-relaxation-
//    hatch rule that governs the rest of this seam governs its argv half too:
//    a root that cannot be honoured REFUSES, and never degrades into a silent
//    read of the default root.
//  - Do not return `undefined` (or a partial result) on a parse error. A
//    caller that cannot tell "no flag" from "a flag I could not read" is the
//    original defect wearing a different shape.
//  - Do not resolve the value here. Resolution and containment are
//    `resolveContainedRoot()`'s job. Keeping them apart is what lets a caller
//    report an argument REJECTION and a containment REFUSAL as distinct
//    messages at the same exit code -- the convention four of the consuming
//    scripts already state verbatim in their preambles.
//  - Do not mint a new exit code for an argv rejection. Every message below
//    begins with the literal `BAD ARGUMENTS --` precisely so the two classes
//    are separated by their MESSAGE, not by their status.

/** Every message this function throws begins with this, so a caller can tell
 *  an argv rejection from a containment refusal by reading the message. */
const BAD = "BAD ARGUMENTS --";

/** The usage line quoted back with every rejection, so a refusal always shows
 *  the operator the accepted spelling rather than only the rejected one. */
function usageLine(script, booleanFlags) {
  const extras = booleanFlags.map((f) => ` [${f}]`).join("");
  return `Usage: node scripts/${script}.mjs [--root <dir>]${extras}`;
}

/**
 * Reads a `--root` argument (and any declared value-less flags) STRICTLY.
 *
 * @param {string[]} argv  normally `process.argv.slice(2)`.
 * @param {{ script: string, booleanFlags?: string[] }} options
 *        `script` is the invoking script's own base name, used ONLY in error
 *        messages so a refusal names its source -- this repository's guards
 *        are invoked as their own file names (D-12-11) and their errors read
 *        the same way. `booleanFlags` lists the value-less flags the caller
 *        also accepts; they are supplied in code, never from argv.
 * @returns {{ root: string | undefined, flags: Record<string, boolean> }}
 *          `root` is the RAW string value, or `undefined` when the flag was
 *          absent (the normal, unflagged invocation). `flags` carries one
 *          `true` entry per declared boolean flag that actually appeared,
 *          keyed by the flag token exactly as declared -- no name mangling,
 *          so a reader of the call site and a reader of the lookup cannot
 *          disagree about the key.
 * @throws {Error} on ANY malformed form. Never warns, never continues, never
 *         falls back to the default root.
 */
export function parseRootArg(argv, { script, booleanFlags = [] } = {}) {
  if (typeof script !== "string" || script.length === 0) {
    throw new Error(
      "parseRootArg: `script` is required and must be a non-empty base name -- a rejection " +
        "that cannot name the script it came from is not diagnosable, which is the whole " +
        "point of rejecting.",
    );
  }

  const usage = usageLine(script, booleanFlags);
  const tokens = Array.isArray(argv) ? argv : [];

  /** @type {string | undefined} */
  let root;
  /** @type {Record<string, boolean>} */
  const flags = {};

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (booleanFlags.includes(token)) {
      flags[token] = true;
      continue;
    }

    // The equals form is REJECTED rather than accepted, because the defect
    // being fixed is an operator typo reaching a filesystem write: a parser
    // that quietly understands a spelling the rest of the seam does not is
    // how a mistyped root became an overwrite of the real repository.
    if (token.startsWith("--root=")) {
      throw new Error(
        `${BAD} ${JSON.stringify(token)} uses the equals form. The space-separated spelling ` +
          "`--root <dir>` is the ONLY accepted one. Write: node scripts/" +
          `${script}.mjs --root ${JSON.stringify(token.slice("--root=".length))}. ${usage}`,
      );
    }

    if (token !== "--root") {
      throw new Error(`${BAD} unrecognised argument ${JSON.stringify(token)}. ${usage}`);
    }

    const value = tokens[i + 1];

    // A following token that is itself a flag is a MISSING value, not a value.
    // Treating `--root --json` as "root is --json" is exactly the kind of
    // guess that turns a typo into a write against the wrong tree.
    if (value === undefined || value.startsWith("--")) {
      const why =
        value === undefined
          ? "the last argument"
          : `followed by ${JSON.stringify(value)}, which is itself a flag`;
      throw new Error(`${BAD} \`--root\` requires a directory, but it was ${why}. ${usage}`);
    }

    if (value === "") {
      throw new Error(
        `${BAD} \`--root\` was given an empty value. An empty string is not a directory, and ` +
          "it is specifically NOT a request for the default root -- silently falling back to " +
          `the default root is the defect this parser exists to remove. ${usage}`,
      );
    }

    if (root !== undefined) {
      throw new Error(
        `${BAD} \`--root\` was given more than once: ${JSON.stringify(root)} and ` +
          `${JSON.stringify(value)}. A repeated flag is rejected rather than resolved by ` +
          "position, so no invocation's meaning depends on which copy the parser happened to " +
          `keep. ${usage}`,
      );
    }

    root = value;
    i += 1;
  }

  return { root, flags };
}

// ---------------------------------------------------------------------------
// THE SPLIT-READ SEAM (CR-03)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS: `--root` decides which tree a gate reads its CORPUS from. It
// cannot decide where that gate's COMPARISON DATA comes from when the
// comparison data arrives through a static `import` -- a static specifier is
// resolved against the importing file's own location, and no argv value can
// move it. Four gates were in exactly that state: they honoured `--root` for
// the corpus and read the registry from the default root, while three of them
// carried a docblock sentence forbidding precisely that. Under a synthetic tree
// they compared the synthetic corpus against the REAL registry, so a violation
// planted in the synthetic tree was measured against data the plant never
// touched -- a false green inside the audit instrument itself.
//
// The remedy chosen -- of the two the phase-32 verifier named -- is REFUSAL,
// not root-parameterised dynamic imports. Making the imports follow the root
// would require every synthetic tree to carry a working `src/mcp/vice/` module
// graph, at which point it is a copy of the repository rather than a small
// planted corpus, which is not the thing the flag exists to point at.
//
// WHY THE REASON TEXT LIVES HERE AND THE PREFIX LIVES AT THE CALL SITE: the
// same split `resolveContainedRoot()` already uses. Each consumer writes its
// own `<script>: SPLIT READ REFUSED --` prefix, so a refusal always names the
// script that refused; the REASONING -- the part that would otherwise be
// copy-pasted four times and drift four ways, which is `IN-06` exactly -- is
// built once, here.
//
// WHAT NOT TO DO: do not add a bypass. No env var, no `--allow-split-read`, no
// waiver file, no allow-list of "harmless" roots. A root that cannot be
// honoured REFUSES; it is never honoured partially and never degrades into a
// silent read of the default root.

/**
 * Builds the reason half of a split-read refusal message.
 *
 * @param {{ resolvedRoot: string, defaultRoot: string,
 *           imports: { name: string, from: string }[] }} options
 *        `imports` names the identifiers the calling script binds statically
 *        and the specifier each one comes from -- the concrete reason the root
 *        cannot be honoured, so an operator is never left guessing which read
 *        is the split one.
 * @returns {string} the message body. The caller writes
 *          `<script>: SPLIT READ REFUSED -- ` in front of it.
 * @throws {Error} when `imports` is empty: a refusal that cannot say WHAT it
 *         failed to move is not diagnosable, and a script with no such import
 *         has no split read to refuse in the first place.
 */
export function splitReadRefusalReason({ resolvedRoot, defaultRoot, imports } = {}) {
  if (!Array.isArray(imports) || imports.length === 0) {
    throw new Error(
      "splitReadRefusalReason: `imports` must name at least one statically-bound identifier. " +
        "A refusal that cannot say WHAT it could not move is not diagnosable, and a script " +
        "with no such import has no split read to refuse at all.",
    );
  }
  const bound = imports.map((i) => `\`${i.name}\` from \`${i.from}\``).join(", ");
  const plural = imports.length === 1 ? "identifier is" : "identifiers are";
  return (
    `--root resolves to ${resolvedRoot}, which is not this repository's root ${defaultRoot}. ` +
    "This script reads its CORPUS from the resolved root, but its COMPARISON DATA arrives " +
    `through static imports that cannot follow a root override: the ${plural} ${bound}. ` +
    "A static import specifier is resolved against this file's own location, so honouring " +
    `the root would compare a corpus read from ${resolvedRoot} against comparison data read ` +
    `from ${defaultRoot} -- a FALSE GREEN rather than a stricter check, because a violation ` +
    "planted in the resolved tree would be measured against data the plant never touched. " +
    "Refusing rather than half-honouring it (CR-03). Only a --root that RESOLVES to " +
    `${defaultRoot} is accepted here. \`scripts/check-skill-description-overlap.mjs\` is the ` +
    "one skill gate that binds no such import and does honour an arbitrary contained root."
  );
}
