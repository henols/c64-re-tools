#!/usr/bin/env node
// scripts/lib/anno-cli-verbs.mjs -- the ONE definition of the `anno` CLI
// verb list, PARSED from `anno-cli.ts`'s own dispatch `switch (verb)` --
// never a hand-typed array.
//
// THE SUBCOMMAND IS `anno`, RENAMED FROM `r2000` on 2026-08-29 (phase 29 plan
// 29-09). Three halves spell that name and they move together, in one commit,
// or this module's own predicate reds from the wrong side: the skill prose
// that tells a reader how to invoke the CLI, the invocation literal
// `verbsMissingFromSkills()` matches at the bottom of this file, and
// `vice-proxy.ts`'s subcommand token. Changing any one alone reports every
// verb as undocumented while the documentation is in fact correct.
//
// FLOW-01 (11.1-CONTEXT.md, D-11.1-02): `scripts/check-skill-tool-coverage.mjs`
// checked `r2000_*` MCP TOOL names in skill prose but never CLI VERBS at
// all, so `gen-enums`, `export-lbl` and `import-lbl` -- the delivery path
// for R2000-13/-14/-15 -- reached `main` documented in zero skill files
// with nothing catching it. A hard-coded verb array in the checker would
// have been the same defect deferred (the guard-first organising principle
// 11.1-CONTEXT.md states explicitly), so this module reads the verb list
// out of the dispatch switch itself.
//
// This module is imported by BOTH `scripts/check-skill-tool-coverage.mjs`
// (the CI script) and `src/mcp/vice/anno-verb-coverage.test.ts` (the
// committed non-vacuity/planted-violation proof) -- one definition, two
// callers, the same "single seam, two callers" shape `version.ts` /
// `scripts/version.mjs` already use in this repo. `check-skill-tool-
// coverage.mjs` executes its whole check at import time, so importing THAT
// file from a test would re-run the live gate rather than letting the test
// call the predicate in isolation -- exactly why this logic could not stay
// inline in the CI script.
//
// Lives under `scripts/lib/`, not `src/mcp/vice/`, on purpose: it has
// no runtime role in the shipped MCP server, so it must stay out of
// `src/mcp/vice/package.json`'s `files[]` (a shipped-runtime allow-list
// enforced by `scripts/check-npm-packages.mjs`), while still being tracked
// by git so `scripts/package.sh`'s `git archive` includes it.

/**
 * The measured true count of `anno` CLI verbs: `coverage` and `render-memmap`.
 *
 * THIS IS A REPLACEMENT OVER A NEW SUBJECT, NOT A LOWERING -- and the
 * distinction is the whole reason this paragraph exists. A bare smaller number
 * sitting under the old comment would read as exactly the regression that
 * comment forbids.
 *
 * THE PREVIOUS FLOOR WAS 8, and it was correct for a verb set that no longer
 * exists. Plan 29-07 (D-14, 2026-08-29) removed six verbs -- `bootstrap`,
 * `export-asm`, `verify`, `gen-enums`, `export-lbl` and `import-lbl` -- because
 * every one of them was a delivery path into the retired external analyser,
 * three directly and three through capability modules. They are DELETED, not
 * disabled, so the population this floor is a floor OVER changed underneath it.
 * Holding 8 would not have preserved a discipline; it would have asserted a
 * fact about verbs that are gone.
 *
 * THE RAISE-NEVER-LOWER DISCIPLINE RUNS FORWARD FROM 2, unchanged in force and
 * with a named next event: three of the six -- the enum generator and the two
 * halves of the VICE-label round trip -- return in **Phase 30** as rebuilds
 * over the annotation store, alongside the ACME export oracle. Each verb that
 * lands there raises this floor to the new true count, in the commit that adds
 * it. Nothing lowers it again without a decision of the same weight as D-14,
 * recorded the same way. (The `extractedR2000.size >= 10` floor in
 * `check-skill-tool-coverage.mjs` is the precedent this mirrors, and it is a
 * DIFFERENT guard over a DIFFERENT subject -- MCP tool names, not CLI verbs --
 * so the two numbers never move together.)
 */
export const ANNO_CLI_VERB_FLOOR = 2;

/**
 * Strips `//` line comments and `/* ... *\/` block comments from `src`,
 * leaving every string/template literal's content untouched (so a verb
 * name inside a quoted `case` label survives intact). A single-pass
 * character scanner, not a regex -- this repo's own
 * `docs-dangling-refs.test.ts` measured a regex-alternation extractor
 * silently missing a literal at the exact site a real defect lived, so the
 * same discipline applies here: a commented-out `case "ghost-verb":` must
 * never be mistaken for a real one.
 */
function stripComments(src) {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote = null; // active quote char ('"', "'", "`"), or null when in code
  while (i < n) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
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
    out += c;
    i++;
  }
  return out;
}

/**
 * Scopes `strippedSrc` (already comment-free) to the body of the FIRST
 * `switch (verb) { ... }` statement, via brace-depth counting from that
 * switch's own opening brace to its matching close. Returns the body text
 * with the enclosing braces excluded, or `null` if no such switch is found
 * (or its braces never balance) -- callers must treat `null` as "nothing to
 * parse", never as zero verbs, so a source that stops matching the expected
 * shape fails the floor below rather than silently reporting an empty list.
 */
function switchVerbBody(strippedSrc) {
  const anchor = strippedSrc.indexOf("switch (verb)");
  if (anchor === -1) return null;
  const openBrace = strippedSrc.indexOf("{", anchor);
  if (openBrace === -1) return null;
  let depth = 0;
  let i = openBrace;
  for (; i < strippedSrc.length; i++) {
    if (strippedSrc[i] === "{") depth++;
    else if (strippedSrc[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  return strippedSrc.slice(openBrace + 1, i);
}

/**
 * Parses `src` (the full text of a module shaped like `anno-cli.ts`,
 * containing a `switch (verb) { case "<verb>": ... default: ... }`
 * dispatch) and returns the sorted, de-duplicated list of verbs named by
 * that switch's own `case "<verb>":` labels. The `default:` branch is never
 * matched (it carries no quoted label), and any `case` outside the
 * `switch (verb)` block -- including one sitting inside a comment -- is
 * invisible to this parser by construction: comments are stripped first,
 * and the scan is scoped to the one switch body.
 */
export function parseAnnoCliVerbs(src) {
  const stripped = stripComments(src);
  const body = switchVerbBody(stripped);
  if (body === null) return [];
  const verbs = new Set();
  const CASE_RE = /case\s+"([\w-]+)"\s*:/g;
  let m;
  while ((m = CASE_RE.exec(body)) !== null) {
    verbs.add(m[1]);
  }
  return [...verbs].sort();
}

/**
 * Returns the subset of `verbs` for which NO entry of `skillTexts` contains
 * the literal token `anno <verb>` -- the exact substring
 * `grep -rl 'anno <verb>'` matches, so this predicate and the FLOW-01
 * finding it closes speak the same language.
 */
export function verbsMissingFromSkills(verbs, skillTexts) {
  return verbs.filter((verb) => !skillTexts.some((text) => text.includes(`anno ${verb}`)));
}
