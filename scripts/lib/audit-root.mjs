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
