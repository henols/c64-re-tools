// docs-fork-absence.test.ts
//
// WHY THIS EXISTS: a backend was removed -- its transport, its manifest, its
// probe, its per-backend branching and the documentation routing readers to
// it. The way a deletion like that comes back is almost never a deliberate
// restore. It is a single reintroduced conditional (`if (backend ===
// "fork")`), a second manifest file sitting next to the surviving one, a
// deny-list-shaped guard rebuilt because someone remembered "we used to
// block tool names like that", or a README/skill sentence describing a
// switch that no longer exists. None of those look like a regression while
// they're being written; each looks like a small, reasonable addition. This
// file makes their absence a checked invariant instead of a fact that only
// lived in a set of now-merged commits.
//
// Like the other document/decision guards in this directory
// (`docs-fork-decision.test.ts`, `docs-dangling-refs.test.ts`,
// `spawn-seam.test.ts`), this file verifies the repository rather than
// runtime behaviour shipped in the tarball, and is deliberately kept OUT of
// `package.json`'s `files[]`.
//
// SCOPE, stated up front because it is narrower than "the whole repo":
//   - The shipped TypeScript/`.mts` module set, derived from `package.json`'s
//     `files[]` (via `shipped-modules.ts`'s `shippedTsModules()`) rather than
//     a raw directory listing -- matching the precedent `spawn-seam.test.ts`
//     already set. Scanned with `codeOnly()`-stripped text, NOT raw text:
//     several of these modules carry deliberate prose comments warning a
//     future reader never to reintroduce `forwardToVice()` or
//     `rewriteArguments()` (e.g. `stock-recycle.ts`, `stock-dispatch.ts`,
//     `stock-diagnose.ts`, `anno-tools.ts`). Those comments are the intended,
//     permanent documentation of a closed hazard -- not a reintroduction --
//     and a raw-text scan would be permanently red on a correct tree, which
//     is exactly the failure mode `docs-dangling-refs.test.ts`'s own header
//     warns about: a guard that false-positives gets switched off rather
//     than obeyed. `codeOnly()` (comments and string/template bodies
//     blanked, real code and `${...}` interpolation preserved) is what lets
//     the guard tell "explains why not to" from "does it".
//   - Every `.md` under `src/skills/`, plus `README.md` and `CLAUDE.md`,
//     scanned as raw prose text (no code-stripping applies to prose; the
//     literal mention IS the violation there).
//   - It does NOT scan `.planning/**`. That tree records this removal in
//     detail and legitimately quotes every removed identifier while
//     describing its removal; scanning it would produce exactly the false
//     positives the paragraph above warns about.
//   - It does NOT scan `docs/**` generally. `docs/stock-hard-losses.md` is
//     the one file allowed to name the removed backend's permanent losses;
//     rather than relying on that file simply not being in the scanned set,
//     `EXEMPT_RELATIVE_PATHS` names it explicitly and by exact path (not by
//     a substring that could accidentally exempt something else), so a
//     later widening of the scanned population cannot silently start
//     flagging the one file that is SUPPOSED to discuss the removal.
//
// COMMENT-TEXT DISCIPLINE: this file's own prose above names the forbidden
// identifiers for exactly the reason `codeOnly()`-stripping is needed --
// explaining the hazard requires saying the words. That is safe here for two
// independent reasons: this file is itself a `*.test.ts` file, and the
// shipped-module population this guard scans is `files[]`-derived, which
// contains no test files at all (confirmed by the non-vacuity test below);
// and this file is never added to `files[]` itself, which the non-vacuity
// test below also asserts directly rather than trusting convention alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { repoRoot } from "./repo-root.ts";
import { codeOnly, shippedTsModules } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const THIS_FILE = "docs-fork-absence.test.ts";

/** Named, non-empty set of identifiers whose reappearance ANYWHERE in the
 * scanned population means the fork backend, its transport, its manifest
 * selection or its deny-list-shaped guard has come back in some form. Its
 * own length is asserted non-zero below so an emptied set cannot make every
 * later check in this file vacuously pass by having nothing to look for. */
const FORBIDDEN_IDENTIFIERS: readonly string[] = Object.freeze([
  "VICE_BACKEND",
  "buildBackendAwareTool",
  "probeBackend",
  "DENY_LIST",
  "denyListRefusalMessage",
  "capabilityRefusalMessage",
  "CAPABILITY_REGISTRY",
  "forwardToVice",
  "rewriteArguments",
]);

/** The six whole-file deletions this removal performed. A reappearance of
 * any one of these -- on disk OR back in `package.json`'s `files[]` -- is
 * the same class of regression as a forbidden identifier resurfacing. */
const DELETED_MODULES: readonly string[] = Object.freeze([
  "vice.ts",
  "vice-sync.ts",
  "vice-probe.ts",
  "refresh-manifest.ts",
  "capability-registry.ts",
  "fork-deleted-tools.ts",
]);

/** The one path this guard's identifier scan explicitly exempts, by exact
 * relative path rather than by any substring rule. `docs/stock-hard-losses.md`
 * is the sanctioned acceptance record and is allowed to discuss the removed
 * backend in prose. `docs/**` is not part of this guard's scanned population
 * today (see the header), so this exemption is currently a no-op in
 * practice -- it exists so a later widening of the scan cannot silently
 * start flagging the one file that is SUPPOSED to name the removal. */
const EXEMPT_RELATIVE_PATHS: readonly string[] = Object.freeze(["docs/stock-hard-losses.md"]);

const STOCK_HARD_LOSSES_RELATIVE = "docs/stock-hard-losses.md";

/** Pure predicate: every forbidden identifier literally present in `text`,
 * case-sensitively. Returns `[]` rather than asserting internally, so the
 * planted-violation tests below can drive this EXACT function against
 * in-memory bodies -- no second, parallel implementation of the rule. */
function findForbiddenIdentifiers(text: string): string[] {
  return FORBIDDEN_IDENTIFIERS.filter((id) => text.includes(id));
}

/** Same predicate, but exempting `EXEMPT_RELATIVE_PATHS` by exact path
 * first. This is the function every prose-scanning check below actually
 * calls, so the exemption is exercised by real callers rather than only by
 * its own planted test. */
function scanTextForForbiddenIdentifiers(relPath: string, text: string): string[] {
  if (EXEMPT_RELATIVE_PATHS.includes(relPath)) return [];
  return findForbiddenIdentifiers(text);
}

// -- Deleted-module PROSE CITATIONS -----------------------------------------
//
// The identifier scan above catches a forbidden identifier surviving as CODE
// or as a literal mention. It was never asked whether a deleted module's
// FILENAME is cited in prose as if the module still exists and still owns a
// live responsibility -- a table row like "Transport seam | ... | `vice.ts`"
// passes the identifier scan untouched, because "vice.ts" alone is not one of
// the nine FORBIDDEN_IDENTIFIERS strings. That gap is what let twelve false
// sentences survive an entire phase inside CLAUDE.md. This predicate closes
// it, for prose specifically (see this file's own comment on why the check
// deliberately does not extend to shipped TypeScript modules, alongside the
// checks that wire it over the real corpus, further down this file).

/** Boundary-aware alternation built from `DELETED_MODULES`, with each
 * filename's dot escaped. A match requires the character immediately before
 * the filename to be either the start of the string or something other than
 * a letter, digit, underscore, hyphen or dot -- this is not decoration: a
 * naive substring test for the shortest entry in `DELETED_MODULES`
 * (`vice.ts`) also matches a filename like `device.ts`, which shares the
 * substring `vice.ts` starting at its second character. That is a measured
 * false positive, and a false positive is precisely what gets a guard
 * switched off rather than obeyed. The same boundary is required on the
 * TRAILING side too (end-of-string or a non-identifier/non-dot character),
 * matching its sibling `STALE_MANIFEST_CITATION_RE` below -- without it, a
 * filename that merely STARTS WITH a deleted module's name (`vice.tsx`,
 * `vice.ts.bak`, a markdown anchor like `vice.ts#history`) would be
 * indistinguishable from a real citation of the deleted module. Asserted
 * non-empty by the non-vacuity test below, so an emptied pattern cannot make
 * the citation checks vacuously pass. */
const DELETED_MODULE_CITATION_SOURCE = `(?:^|[^A-Za-z0-9_.-])(${DELETED_MODULES.map((m) => m.replace(/\./g, "\\.")).join("|")})(?:$|[^A-Za-z0-9_.-])`;
const DELETED_MODULE_CITATION_RE = new RegExp(DELETED_MODULE_CITATION_SOURCE, "g");

/** Pure predicate: every deleted-module filename boundary-aware-cited in
 * `text`, SORTED and DE-DUPLICATED so two runs over an unchanged corpus
 * produce byte-identical output and any diff between runs means a real
 * change rather than iteration order. Returns `[]` rather than asserting
 * internally, exactly like `findForbiddenIdentifiers()` above, so the
 * planted-violation tests below drive this EXACT function. */
function findDeletedModuleCitations(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(DELETED_MODULE_CITATION_RE)) {
    found.add(match[1]!);
  }
  return [...found].sort();
}

/** Same predicate, but exempting `EXEMPT_RELATIVE_PATHS` by exact path
 * first -- mirrors `scanTextForForbiddenIdentifiers()` above exactly, so the
 * one sanctioned exception (`docs/stock-hard-losses.md`) is exercised by
 * real callers here too, not only by its own planted test. */
function scanTextForDeletedModuleCitations(relPath: string, text: string): string[] {
  if (EXEMPT_RELATIVE_PATHS.includes(relPath)) return [];
  return findDeletedModuleCitations(text);
}

// -- Stale transport VOCABULARY (a second forbidden-phrase set) ------------
//
// The citation predicate above catches a deleted FILENAME cited as a live
// component. It does not catch stale vocabulary that never named a file at
// all -- the removed backend's launch flag, or the removed manifest's
// filename. Two separate constants, not one, because the manifest filename
// needs the same boundary-aware regex treatment `DELETED_MODULE_CITATION_RE`
// gets (so the surviving `tools-manifest.stock.json` cannot trip it), while
// the launch flag is safe as a plain substring test. Deliberately excluded
// from EITHER set: the removed backend's bare name. This document
// legitimately carries the Debian release codename `forky`, which contains
// that name as a substring, so a bare scan for it would be permanently red
// on a correct tree -- exactly the false-positive failure mode this file's
// own header, and `docs-dangling-refs.test.ts`'s, both warn gets a guard
// switched off rather than obeyed. Both sets are asserted non-empty below.

/** Stale transport phrases, plain-substring matched. */
const FORBIDDEN_TRANSPORT_PHRASES: readonly string[] = Object.freeze(["-mcpserver"]);

/** The removed manifest's filename, matched boundary-aware (dot-escaped,
 * bounded on both sides) exactly like `DELETED_MODULE_CITATION_RE` above, so
 * the surviving `tools-manifest.stock.json` variant cannot trip it. */
const STALE_MANIFEST_FILENAMES: readonly string[] = Object.freeze(["tools-manifest.json"]);
const STALE_MANIFEST_CITATION_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_.-])(${STALE_MANIFEST_FILENAMES.map((m) => m.replace(/\./g, "\\.")).join("|")})(?:$|[^A-Za-z0-9_.-])`,
  "g",
);

/** Pure predicate: every stale transport phrase (plain-substring OR
 * boundary-aware manifest citation) present in `text`, sorted and
 * de-duplicated for the same reason `findDeletedModuleCitations()` is. */
function findStaleTransportPhrases(text: string): string[] {
  const found = new Set<string>();
  for (const phrase of FORBIDDEN_TRANSPORT_PHRASES) {
    if (text.includes(phrase)) found.add(phrase);
  }
  for (const match of text.matchAll(STALE_MANIFEST_CITATION_RE)) {
    found.add(match[1]!);
  }
  return [...found].sort();
}

/** Same predicate, exempting `EXEMPT_RELATIVE_PATHS` by exact path first --
 * mirrors the two wrappers above. */
function scanTextForStaleTransportPhrases(relPath: string, text: string): string[] {
  if (EXEMPT_RELATIVE_PATHS.includes(relPath)) return [];
  return findStaleTransportPhrases(text);
}

// -- SCOPE DECISION, recorded here because the verification report left the
//    choice open and the next reader deserves the reason rather than only
//    the outcome --------------------------------------------------------
//
// WIDEN-IN-PLACE, not a sibling guard: the prose-citation and stale-phrase
// checks above live in THIS file rather than in a new one because they scan
// the exact same population this file already walks (tests 3/4's README.md,
// CLAUDE.md, and every `src/skills/**/*.md`), exempt by the exact same
// `EXEMPT_RELATIVE_PATHS` list, and answer the exact same question this
// whole file exists to answer -- has the removal come back, in any form.
// Splitting that one question across two files would produce two partial
// answers, and two places to remember to widen the next time the removal
// grows a new symptom.
//
// PROSE ONLY, deliberately NOT extended to the shipped TypeScript module
// set: several shipped modules (`stock-recycle.ts`, `stock-dispatch.ts`,
// `stock-diagnose.ts`, `anno-tools.ts`) carry deliberate, permanent comments
// naming a deleted module or the removed manifest filename while warning a
// future reader never to reintroduce it. In CODE, those comments ARE the
// documentation of a closed hazard. In PROSE (README.md, CLAUDE.md, skill
// markdown), the same words mean something different -- there is no
// "hazard being documented" reading available, because prose never carries
// the "never reintroduce this" framing test 2's `codeOnly()`-stripped scan
// relies on; a filename cited in prose is read by a human (or by an agent
// deciding what is architecturally true) as a description of the CURRENT
// system. The mention there IS the claim, not a warning about one.
//
// The planning tree stays out, extending the exclusion this file's header
// already documents for the identifier scan: `.planning/**` records this
// removal in detail and legitimately quotes every removed name while
// describing its removal, so scanning it would produce exactly the false
// positives the header warns against.

/** Every file scanned by the prose-citation and stale-phrase checks below:
 * the two whole-document prose files plus every shipped skill markdown
 * file. Computed once so both checks (and the non-vacuity floor) walk
 * identically. */
function proseCitationPopulation(): string[] {
  return ["README.md", "CLAUDE.md", ...skillMarkdownFiles()];
}

/** Every `*.md` file under `src/skills/`, recursively, as paths relative to
 * `ROOT`. A raw `readdirSync` walk (not `files[]`-derived): skill markdown is
 * shipped as a directory tree, not enumerated in `package.json`. */
function skillMarkdownFiles(): string[] {
  const skillsRoot = join(ROOT, "src/skills");
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) out.push(full);
    }
  };
  walk(skillsRoot);
  return out.map((f) => relative(ROOT, f));
}

function readPkg(): { files: string[] } {
  return JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
}

// -- 1. Non-vacuity: the scanned population is real, and the forbidden set
//    and this file's own exclusions are not accidentally empty ------------

test("1. non-vacuity: the scanned population clears a floor, the forbidden-identifier set is non-empty, and this file is excluded from files[]", () => {
  assert.ok(
    FORBIDDEN_IDENTIFIERS.length > 0,
    "FORBIDDEN_IDENTIFIERS must be non-empty -- an emptied set would make every other check in this file vacuously pass",
  );
  assert.ok(DELETED_MODULES.length > 0, "DELETED_MODULES must be non-empty");
  assert.ok(
    DELETED_MODULE_CITATION_SOURCE.length > 0,
    "the deleted-module citation regex source must not be empty -- an emptied pattern would make the " +
      "prose-citation checks vacuously pass",
  );
  assert.ok(
    FORBIDDEN_TRANSPORT_PHRASES.length > 0,
    "FORBIDDEN_TRANSPORT_PHRASES must be non-empty -- an emptied set would make the stale-phrase check vacuously pass",
  );
  assert.ok(
    STALE_MANIFEST_FILENAMES.length > 0,
    "STALE_MANIFEST_FILENAMES must be non-empty -- an emptied set would make the stale-phrase check vacuously pass",
  );

  const shipped = shippedTsModules(HERE);
  const skillsMd = skillMarkdownFiles();
  // README.md + CLAUDE.md, the two whole-document prose files scanned below.
  const totalScanned = shipped.length + skillsMd.length + 2;
  assert.ok(
    totalScanned >= 95,
    `expected at least 95 scanned files (shipped modules + skill docs + README.md + CLAUDE.md), found ${totalScanned} -- ` +
      "a shrunken population is a guard that scans nothing and finds nothing",
  );

  // The narrower population the prose-citation and stale-phrase checks (8
  // and 9, below) walk: README.md + CLAUDE.md + skill markdown, WITHOUT the
  // shipped TypeScript modules (see the scope-decision comment above test
  // 8). The real count today is twenty files; the floor is set 2 files below
  // today's count so a deliberate pruning does not red this, but an absence
  // guard whose scanned set is empty -- or whose token list is empty --
  // passes vacuously and protects nothing, which is the single most
  // important predicate in this file.
  const proseScanned = proseCitationPopulation().length;
  assert.ok(
    proseScanned >= 18,
    `expected at least 18 files in the prose-citation scan population (README.md + CLAUDE.md + skill docs), ` +
      `found ${proseScanned} -- an absence guard whose scanned set is empty protects nothing`,
  );

  const pkg = readPkg();
  assert.ok(
    !pkg.files.includes(THIS_FILE),
    `${THIS_FILE} must never be added to package.json's files[] -- it verifies the repository, not runtime behaviour shipped in the tarball, exactly like its docs-*.test.ts siblings`,
  );
  // shippedTsModules()'s filter is a bare `.ts`/`.mts` suffix test, which
  // would also match a *.test.ts entry if one were ever added to files[] by
  // mistake -- confirmed directly rather than assumed from the exclusion
  // above alone.
  assert.ok(
    !shippedTsModules(HERE).includes(THIS_FILE),
    `${THIS_FILE} must not appear in the files[]-derived shipped module set`,
  );
});

// -- 2. No forbidden identifier survives as real code in any shipped
//    .ts/.mts module -------------------------------------------------------

test("2. no forbidden identifier appears as real code (not a comment or string) in any shipped .ts/.mts module", () => {
  const offenders: string[] = [];
  for (const file of shippedTsModules(HERE)) {
    const raw = readFileSync(join(HERE, file), "utf8");
    const hits = findForbiddenIdentifiers(codeOnly(raw));
    if (hits.length > 0) offenders.push(`${file}: ${hits.join(", ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `forbidden identifier(s) found as real code in the shipped module set: ${offenders.join(" | ")}`,
  );
});

// -- 3. No forbidden identifier in README.md or CLAUDE.md ------------------

test("3. no forbidden identifier appears in README.md or CLAUDE.md", () => {
  const offenders: string[] = [];
  for (const relPath of ["README.md", "CLAUDE.md"]) {
    const text = readFileSync(join(ROOT, relPath), "utf8");
    const hits = scanTextForForbiddenIdentifiers(relPath, text);
    if (hits.length > 0) offenders.push(`${relPath}: ${hits.join(", ")}`);
  }
  assert.deepEqual(offenders, [], `forbidden identifier(s) found in project-instruction files: ${offenders.join(" | ")}`);
});

// -- 4. No forbidden identifier in any shipped skill markdown --------------

test("4. no forbidden identifier appears in any src/skills/**/*.md file", () => {
  const offenders: string[] = [];
  for (const relPath of skillMarkdownFiles()) {
    const text = readFileSync(join(ROOT, relPath), "utf8");
    const hits = scanTextForForbiddenIdentifiers(relPath, text);
    if (hits.length > 0) offenders.push(`${relPath}: ${hits.join(", ")}`);
  }
  assert.deepEqual(offenders, [], `forbidden identifier(s) found in shipped skill text: ${offenders.join(" | ")}`);
});

// -- 5. Exactly one manifest ------------------------------------------------

test("5. tools-manifest.stock.json exists and is the only tools-manifest*.json file", () => {
  assert.ok(
    existsSync(join(HERE, "tools-manifest.stock.json")),
    "tools-manifest.stock.json is missing -- the surviving manifest was lost",
  );
  const manifestLike = readdirSync(HERE)
    .filter((f) => /^tools-manifest.*\.json$/.test(f))
    .sort();
  assert.deepEqual(
    manifestLike,
    ["tools-manifest.stock.json"],
    `expected exactly one tools-manifest*.json file, found: ${manifestLike.join(", ") || "(none)"}`,
  );
});

// -- 6. None of the six deleted modules has reappeared ---------------------

test("6. none of the six deleted modules has reappeared on disk or in files[]", () => {
  const pkg = readPkg();
  const offenders: string[] = [];
  for (const mod of DELETED_MODULES) {
    if (existsSync(join(HERE, mod))) offenders.push(`${mod} exists on disk`);
    if (pkg.files.includes(mod)) offenders.push(`${mod} is listed in package.json's files[]`);
  }
  assert.deepEqual(offenders, [], offenders.join(" | "));
});

// -- 7. The acceptance record exists, is reachable, and is non-vacuous -----

test("7. docs/stock-hard-losses.md exists, is non-vacuous, names all three losses, and is cited by README.md", () => {
  const full = join(ROOT, STOCK_HARD_LOSSES_RELATIVE);
  assert.ok(existsSync(full), `${STOCK_HARD_LOSSES_RELATIVE} does not exist`);
  const contents = readFileSync(full, "utf8");
  assert.ok(
    contents.length > 1000,
    `${STOCK_HARD_LOSSES_RELATIVE} is only ${contents.length} bytes -- an emptied stub cannot pass this floor`,
  );
  assert.ok(contents.includes("SID"), `${STOCK_HARD_LOSSES_RELATIVE} does not mention 'SID'`);
  assert.ok(contents.includes("RESTORE"), `${STOCK_HARD_LOSSES_RELATIVE} does not mention 'RESTORE'`);
  assert.ok(
    contents.includes("vice_keyboard_matrix"),
    `${STOCK_HARD_LOSSES_RELATIVE} does not mention the tool name 'vice_keyboard_matrix'`,
  );
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(STOCK_HARD_LOSSES_RELATIVE), `README.md does not cite ${STOCK_HARD_LOSSES_RELATIVE}`);
});

// -- 8. No deleted module filename is cited as a live component in prose ---
//
// This is the gap this plan closes: tests 3/4 above check for the nine
// FORBIDDEN_IDENTIFIERS strings; this check walks the SAME population and
// asks a different question -- is a deleted module's FILENAME cited in
// prose as though it still exists and still owns a live responsibility.

test("8. no deleted module filename is cited in prose across README.md, CLAUDE.md, or any src/skills/**/*.md file", () => {
  const offenders: string[] = [];
  for (const relPath of proseCitationPopulation()) {
    const text = readFileSync(join(ROOT, relPath), "utf8");
    const hits = scanTextForDeletedModuleCitations(relPath, text);
    if (hits.length > 0) offenders.push(`${relPath}: ${hits.join(", ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `deleted module filename(s) cited as live component(s) in prose: ${offenders.join(" | ")}`,
  );
});

// -- 9. No stale transport vocabulary survives in the same prose population -

test("9. no stale transport phrase (removed launch flag; removed manifest filename) appears in prose across the same population", () => {
  const offenders: string[] = [];
  for (const relPath of proseCitationPopulation()) {
    const text = readFileSync(join(ROOT, relPath), "utf8");
    const hits = scanTextForStaleTransportPhrases(relPath, text);
    if (hits.length > 0) offenders.push(`${relPath}: ${hits.join(", ")}`);
  }
  assert.deepEqual(offenders, [], `stale transport phrase(s) found in prose: ${offenders.join(" | ")}`);
});

// -- 10. Planted violations (committed), driving the REAL predicates -------

test("planted violation: an in-memory body containing a forbidden identifier is reported", () => {
  const hits = findForbiddenIdentifiers('export const VICE_BACKEND = "stock";');
  assert.deepEqual(hits, ["VICE_BACKEND"]);
});

test("planted violation control: an in-memory body with none of the forbidden identifiers reports nothing", () => {
  const hits = findForbiddenIdentifiers("export const STOCK_ONLY = true;");
  assert.deepEqual(hits, []);
});

test("planted violation control: a forbidden identifier mentioned only inside a comment or string literal in TS source is not discovered once codeOnly() strips it", () => {
  const src =
    `// this module used to call forwardToVice() before the fork was removed -- never reintroduce it\n` +
    `export const NOTE = "never call rewriteArguments() again";\n` +
    `export function real(): number { return 1; }\n`;
  const hits = findForbiddenIdentifiers(codeOnly(src));
  assert.deepEqual(
    hits,
    [],
    "a forbidden identifier mentioned only in a comment or string literal must not survive codeOnly() stripping",
  );
});

test("planted violation: a forbidden identifier written as REAL code in TS source is still discovered after codeOnly() stripping", () => {
  const src = `import { DENY_LIST } from "./somewhere.ts";\nexport const x = DENY_LIST;\n`;
  const hits = findForbiddenIdentifiers(codeOnly(src));
  assert.deepEqual(hits, ["DENY_LIST"]);
});

test("planted violation control: a body at the exempt path (docs/stock-hard-losses.md) containing a forbidden identifier is not reported", () => {
  const hits = scanTextForForbiddenIdentifiers(STOCK_HARD_LOSSES_RELATIVE, "export const DENY_LIST = [];");
  assert.deepEqual(
    hits,
    [],
    "the one exempt path must never be reported even if it contained a forbidden identifier",
  );
});

test("planted violation: the identical body at a non-exempt path IS reported", () => {
  const hits = scanTextForForbiddenIdentifiers("some/other/file.md", "export const DENY_LIST = [];");
  assert.deepEqual(hits, ["DENY_LIST"]);
});

// -- 11. Planted violations for the deleted-module CITATION predicate ------
//
// The boundary is the whole point: a real citation of a deleted module must
// be reported, and a filename that only TOUCHES a deleted one as a substring
// (`device.ts` contains `vice.ts` starting at its second character) must not
// be merged with it.

test("planted violation: an in-memory body citing a deleted module filename is reported", () => {
  const hits = findDeletedModuleCitations("The transport seam lives in `src/mcp/vice/vice.ts`.");
  assert.deepEqual(hits, ["vice.ts"]);
});

test("planted violation control: an in-memory body containing only `device.ts` -- a filename that merely touches a deleted one as a substring -- reports nothing", () => {
  const hits = findDeletedModuleCitations("The disk-access family cross-references `src/mcp/vice/device.ts`.");
  assert.deepEqual(hits, []);
});

test("planted violation control: an in-memory body containing only `vice.tsx` -- a filename that merely STARTS WITH a deleted one -- reports nothing", () => {
  const hits = findDeletedModuleCitations("See `src/mcp/vice/vice.tsx` for the (nonexistent) React variant.");
  assert.deepEqual(hits, []);
});

test("planted violation control: a body at the exempt path (docs/stock-hard-losses.md) citing a deleted module filename is not reported", () => {
  const hits = scanTextForDeletedModuleCitations(STOCK_HARD_LOSSES_RELATIVE, "See src/mcp/vice/vice.ts for history.");
  assert.deepEqual(
    hits,
    [],
    "the one exempt path must never be reported even if it cited a deleted module filename",
  );
});

test("planted violation: the identical body at a non-exempt path IS reported", () => {
  const hits = scanTextForDeletedModuleCitations("some/other/file.md", "See src/mcp/vice/vice.ts for history.");
  assert.deepEqual(hits, ["vice.ts"]);
});

// -- 12. Planted violations for the stale-transport-phrase predicate -------
//
// Two directions matter here too: the removed launch flag and the removed
// manifest filename must both be caught, and the surviving
// `tools-manifest.stock.json` variant must not be.

test("planted violation: an in-memory body containing the removed launch flag is reported", () => {
  const hits = findStaleTransportPhrases("Launch with `-mcpserver -mcpserverhost 127.0.0.1 -mcpserverport 6502`.");
  assert.deepEqual(hits, ["-mcpserver"]);
});

test("planted violation: an in-memory body citing the removed manifest filename is reported", () => {
  const hits = findStaleTransportPhrases("The advertised surface is read from `tools-manifest.json`.");
  assert.deepEqual(hits, ["tools-manifest.json"]);
});

test("planted violation control: an in-memory body citing only the surviving tools-manifest.stock.json variant reports nothing", () => {
  const hits = findStaleTransportPhrases("The advertised surface is read from `tools-manifest.stock.json`.");
  assert.deepEqual(
    hits,
    [],
    "the surviving manifest variant must never be reported as the removed one",
  );
});

test("planted violation control: a body at the exempt path (docs/stock-hard-losses.md) citing a stale transport phrase is not reported", () => {
  const hits = scanTextForStaleTransportPhrases(STOCK_HARD_LOSSES_RELATIVE, "Launched with -mcpserver.");
  assert.deepEqual(
    hits,
    [],
    "the one exempt path must never be reported even if it cited a stale transport phrase",
  );
});

test("planted violation: the identical body at a non-exempt path IS reported", () => {
  const hits = scanTextForStaleTransportPhrases("some/other/file.md", "Launched with -mcpserver.");
  assert.deepEqual(hits, ["-mcpserver"]);
});
