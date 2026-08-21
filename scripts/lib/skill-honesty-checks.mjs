#!/usr/bin/env node
// scripts/lib/skill-honesty-checks.mjs -- shared predicates for
// `scripts/check-skill-fork-honesty.mjs`, proven non-vacuous by a committed
// test (`.claude/mcp/vice/skill-honesty-checks.test.ts`) that this module
// makes possible in the first place.
//
// `check-skill-fork-honesty.mjs` runs its whole check at import time (it is
// a plain top-level script, not a function you can call), so none of its
// inline predicates could ever be proven non-vacuous by a committed test --
// only by re-running the live script and reading its exit code, which says
// nothing about whether the PREDICATE itself, in isolation, actually
// distinguishes a violation from a clean file. This module is the "single
// seam, two callers" shape `scripts/lib/r2000-cli-verbs.mjs` (plan 11.1-02)
// already established in this repo, for the same reason: pull the logic out
// so a test can call it directly.
//
// Lives under `scripts/lib/`, not `.claude/mcp/vice/`, on purpose: neither
// export has a runtime role in the shipped MCP server, so this file must
// stay out of `.claude/mcp/vice/package.json`'s `files[]` (a shipped-runtime
// allow-list enforced by `scripts/check-npm-packages.mjs`) while still being
// tracked by git so `scripts/package.sh`'s `git archive` includes it.
//
// Both exports take content as STRINGS -- never a path to import, require,
// eval or spawn. `check-skill-fork-honesty.mjs`'s own header rule (it only
// ever `readFileSync()`s and regex-matches skill-tree content, which is
// untrusted/first-party prose) is preserved by construction: nothing here
// can execute anything it is handed.

/**
 * Returns a list of violation strings for `content` against `spec`:
 *   - one per string in `spec.forbidden` that IS present in `content`
 *   - one per string in `spec.required` that is NOT present in `content`
 *
 * Deliberately checks both directions in one predicate (WR-11): a rewording
 * that dropped both the false claim and its true replacement would pass a
 * one-directional "forbidden absent" check while telling the reader
 * nothing -- exactly the "allowlist that SHRINKS BY FAILING" doctrine this
 * script's own header names. Returns `[]` when `content` is clean.
 */
export function fileClaimViolations(content, { forbidden = [], required = [] } = {}) {
  const violations = [];
  for (const needle of forbidden) {
    if (content.includes(needle)) {
      violations.push(`forbidden claim "${needle}" is present`);
    }
  }
  for (const needle of required) {
    if (!content.includes(needle)) {
      violations.push(`required claim "${needle}" is absent`);
    }
  }
  return violations;
}

/**
 * IN-03: true only when `disasm` appears in `line` as a bare, standalone
 * token -- never as a substring of a hyphenated module name. The original
 * `/\bdisasm\b/` pattern false-positived on `disasm-decoder.ts`,
 * `disasm-opcodes.ts`, `disasm-renderer.ts` and any other Phase 4
 * `disasm-*.ts` module name, because `-` is a non-word character and so
 * satisfies `\b` on both sides of the match. A skill doc naming those
 * PROTECTED modules (CLAUDE.md's standing constraint; do not touch or
 * rename them) must be able to do so without tripping the R2000-05 deletion
 * pin about a `disasm` VERB that plan 10-06 deleted from `acme.mjs`.
 *
 * Excluded by construction (NOT violations):
 *   "see .claude/mcp/vice/disasm-decoder.ts for the opcode table"
 *   "disasm-opcodes.ts and disasm-renderer.ts are the other two modules"
 * Still caught (real reintroductions of the deleted verb):
 *   "run acme.mjs disasm foo.prg"
 *   "the disasm verb scaffolds a listing"
 */
export function isStandaloneDisasmToken(line) {
  const re = /\bdisasm\b/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const matchLen = m[0].length;
    const before = line[m.index - 1];
    const beforeBefore = line[m.index - 2];
    const after = line[m.index + matchLen];
    const afterAfter = line[m.index + matchLen + 1];
    // `\b` alone treats `-` as a non-word boundary character, so
    // `\bdisasm\b` already matches "disasm-decoder.ts" (IN-03's exact bug):
    // `-` before `d` and `-` after `m` both satisfy `\b`. These two extra
    // checks are the fix -- exclude a hyphen-adjacent letter on either side,
    // which is exactly the `disasm-*.ts` module-name shape, not the deleted
    // standalone verb.
    const precededByLetterDash = before === "-" && /[a-z0-9]/i.test(beforeBefore ?? "");
    const followedByDashLetter = after === "-" && /[a-z0-9]/i.test(afterAfter ?? "");
    if (precededByLetterDash || followedByDashLetter) continue;
    return true;
  }
  return false;
}
