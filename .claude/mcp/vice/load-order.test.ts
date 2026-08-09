// node:test coverage of Criterion 10's load-order landmine (01.6-RESEARCH.md
// §E): install-resources.mjs takes the repo root as an ARGUMENT and imports
// NOTHING from repo-root.mjs, specifically to avoid a module cycle that
// crashes with "Cannot access 'HERE' before initialization" the moment
// repo-root.mjs's own `ensureResourcesInstalled({ root: repoRoot() })` call
// (at the bottom of its module body) runs before install-resources.mjs has
// finished evaluating.
//
// RESEARCH.md §E reproduced this LIVE, twice, and found the crash is
// specifically a TOP-LEVEL-SYNCHRONOUS-ACCESS hazard: a lazily-called
// reintroduction of the forbidden import does NOT crash today, while still
// leaving the codebase one reordering away from it. That nuance is why this
// file drives a STATIC SOURCE-TEXT check rather than a runtime-crash-based
// test -- only a text-level check forbids the import categorically,
// regardless of how it would be called.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Part 1: the direct guard -- install-resources.mjs never imports from
// repo-root.mjs, in any form.
// ============================================================================

// STATEMENT-ANCHORED, deliberately. 01.6-RESEARCH.md §E(c)'s own proposed
// regex (`/from\s+["']\.\/repo-root(\.[jt]s)?["']/`) has TWO problems, both
// found by the planner and neither recorded anywhere before this task:
//
//   1. Its extension group `(\.[jt]s)?` covers only the two-letter forms
//      (.js, .ts) -- against TODAY's sources, where the only specifier that
//      exists is "./repo-root.mjs", that regex would never match ANYTHING,
//      making the gate pass unconditionally and catch nothing. Widened below
//      to `(?:\.[cm]?[jt]s)?`, covering .js/.ts/.mjs/.cjs/.mts/.cts, plus the
//      bare extensionless form (the group is optional).
//   2. Widening the extension group creates a SECOND trap: install-
//      resources.mjs's own header comment (lines 19-21) quotes the forbidden
//      import VERBATIM, in prose: `adding \`import { repoRoot } from
//      "./repo-root.mjs"\` here`. An UNANCHORED search for that specifier
//      text matches this comment line and fails the gate on a file that is
//      entirely correct -- a self-invalidating check a later maintainer
//      would be tempted to "fix" by weakening it further.
//
// The fix for trap 2 is anchoring the pattern to the START of a statement:
// optional leading whitespace, then the literal `import` keyword, optionally
// followed by the type-only modifier (`import type { ... }`). The header
// comment's line begins with `// Do not "clean this up"...` -- `//` is not
// `import`, so the anchor excludes it structurally, regardless of what the
// comment goes on to quote. A type-only NAMED import (`import { type
// repoRoot } from ...`) is also caught: the anchor only requires `import`
// plus optional whitespace before the (unconstrained) import clause, so it
// matches regardless of where inside the clause a `type` keyword appears.
//
// `[^;]*?` (not `[\s\S]*?`) bounds the lazy match to the CURRENT statement --
// real import statements contain no internal `;`, so this cannot leak across
// an unrelated import's own terminator into a later, unrelated `from`
// clause, while still spanning the multi-line brace lists this module tree
// actually uses (a negated character class matches newlines even though `.`
// does not).
//
// A type-only import (`import type { repoRoot } from "./repo-root.mjs"`) is
// erased before module resolution even happens -- confirmed live in
// 01.6-RESEARCH.md §E(b) -- so it happens to be harmless TODAY. It is
// rejected here anyway: that safety is an ACCIDENT of erasure, not evidence
// of discipline, and special-casing it as "fine" would teach exactly the
// wrong lesson about why this rule exists.
const IMPORT_REPO_ROOT_PATTERN =
  /^[ \t]*import(?:\s+type)?\s+[^;]*?from\s+["']\.\/repo-root(?:\.[cm]?[jt]s)?["']/m;

/** Wraps IMPORT_REPO_ROOT_PATTERN as a named predicate so both the real-file
 * assertion and the regression tests below read the same way. */
function importsRepoRoot(text: string): boolean {
  return IMPORT_REPO_ROOT_PATTERN.test(text);
}

test("importsRepoRoot(): regression corpus -- catches every import shape, including type-only and the widened .mjs extension; never fires on prose that merely quotes the import", () => {
  assert.ok(
    importsRepoRoot('import { repoRoot } from "./repo-root.mjs";'),
    "a plain .mjs value import must be caught -- this is the exact shape RESEARCH.md §E(c)'s own " +
      "proposed regex would have missed entirely (its extension group only covers .js/.ts)"
  );
  assert.ok(
    importsRepoRoot('import type { repoRoot } from "./repo-root.mjs";'),
    "a type-only import (`import type { ... }`) must be caught -- it is erased before module " +
      "resolution and so happens to be harmless today, which is exactly why a naive 'it's just a " +
      "type import' exemption would send the wrong signal (RESEARCH.md §E(b))"
  );
  assert.ok(
    importsRepoRoot('import { type repoRoot } from "./repo-root.mjs";'),
    "a named type-only import (`import { type repoRoot }`) must also be caught"
  );
  assert.ok(
    importsRepoRoot('import { repoRoot } from "./repo-root.ts";'),
    "a future .ts conversion of the specifier must still be caught"
  );
  assert.ok(
    importsRepoRoot('import { repoRoot } from "./repo-root";'),
    "a bare, extensionless specifier must be caught"
  );
  assert.ok(
    importsRepoRoot('import {\n  repoRoot,\n  supervisorDir,\n} from "./repo-root.mjs";'),
    "a multi-line brace-list import must be caught -- this module tree's own real imports (this very " +
      "file's edit history) span multiple lines"
  );
  assert.ok(
    !importsRepoRoot(
      '// Do not "clean this up" by adding `import { repoRoot } from "./repo-root.mjs"` here -- that\n' +
        "// importable convenience is exactly the cycle described above."
    ),
    "prose that merely QUOTES the forbidden import inside a comment (install-resources.mjs's own " +
      "header, verbatim) must NOT be classified as an import -- an unanchored search would fail this " +
      "file for describing the rule it correctly follows"
  );
  assert.ok(
    !importsRepoRoot('import { hostPath, SET_ENV_HINT } from "./hostpath.mjs";'),
    "an unrelated sibling import must not false-positive"
  );
});

/** Filters `moduleNames` to entries whose basename minus its extension
 * equals `stem`, and requires exactly one match -- throwing a message
 * naming the stem and what it found otherwise. Split from
 * resolveModuleByStem() below (which supplies the real flat directory via
 * listModuleFiles()) so the zero/one/two-match cases can be exercised
 * directly against a synthetic corpus, the same directly-testable-pure-
 * function pattern this file already uses for importsRepoRoot() and
 * moduleScopeRepoRootCalls() above.
 *
 * Zero matches means the subject this file names by stem has renamed away
 * from every enumerated file -- a loud, survivable failure. Two matches
 * means both the old and new extension transiently coexist on disk (a
 * rename mid-flight); picking one silently would check the stale copy
 * while the real file goes unpoliced, which is the specific failure this
 * task exists to prevent -- so this throws in that case too, never picks. */
function resolveStemAgainst(moduleNames: string[], stem: string): string {
  const matches = moduleNames.filter((name) => {
    const dot = name.lastIndexOf(".");
    return (dot === -1 ? name : name.slice(0, dot)) === stem;
  });
  if (matches.length !== 1) {
    throw new Error(
      `resolveModuleByStem(${JSON.stringify(stem)}): expected exactly one match, found ` +
        `${matches.length}${matches.length > 0 ? `: ${JSON.stringify(matches)}` : ""} in ` +
        `${JSON.stringify(moduleNames)}. Picking the stale copy while the real one goes unpoliced is ` +
        "exactly the failure this resolver exists to prevent."
    );
  }
  return matches[0];
}

/** Resolves a module file by STEM against the real flat directory this file
 * itself polices (listModuleFiles()'s own enumeration) -- so a rename of
 * this test's own subject needs no edit here, ever. See
 * resolveStemAgainst() above for the resolution and throw behaviour. */
function resolveModuleByStem(stem: string): string {
  return resolveStemAgainst(listModuleFiles(), stem);
}

test("resolveStemAgainst(): regression corpus -- exactly one match resolves by stem regardless of extension, zero matches throws naming the stem, two matches throws rather than silently picking one", () => {
  assert.equal(
    resolveStemAgainst(["install-resources.mjs", "hostpath.mjs"], "install-resources"),
    "install-resources.mjs",
    "exactly one match for the stem must resolve to that file, whatever its extension"
  );
  assert.equal(
    resolveStemAgainst(["install-resources.ts", "hostpath.mjs"], "install-resources"),
    "install-resources.ts",
    "the resolver must be extension-agnostic -- a renamed subject resolves identically, which is the " +
      "whole point: no future rename of this file's own subject requires an edit here"
  );
  assert.throws(
    () => resolveStemAgainst(["hostpath.mjs", "containerpath.mjs"], "install-resources"),
    /expected exactly one match, found 0/,
    "zero matches must throw loudly, naming the stem and the count -- a skipped assertion here (the " +
      "subject silently going unpoliced after a rename) is the failure this task exists to prevent"
  );
  assert.throws(
    () => resolveStemAgainst(["install-resources.mjs", "install-resources.ts"], "install-resources"),
    /expected exactly one match, found 2/,
    "two matches -- both the old and new extension transiently coexisting on disk mid-rename -- must " +
      "throw rather than silently picking one; picking the stale copy while the real file goes " +
      "unpoliced is the specific failure named in this task's own <behavior>"
  );
});

test("Criterion 10: install-resources.mjs never imports from repo-root.mjs, in any form", () => {
  const subject = resolveModuleByStem("install-resources");
  const src = readFileSync(join(HERE, subject), "utf8");
  assert.ok(
    !importsRepoRoot(src),
    "install-resources.mjs must not import from repo-root.mjs -- this reintroduces the module cycle " +
      "documented in this file's own header comment (lines 6-21) and reproduced LIVE in " +
      "01.6-RESEARCH.md §E, crashing with exactly: " +
      '"ReferenceError: Cannot access \'HERE\' before initialization". The cycle is avoided ' +
      "structurally today because install-resources.mjs takes the repo root as a PARAMETER; see its " +
      "own header for the full rationale, and 01.6-RESEARCH.md §E for the live reproduction (including " +
      "the nuance that a LAZILY-called reintroduction would not crash today while still being one " +
      "reordering away from it -- which is why this is a static text check, not a runtime one)."
  );
});

// ============================================================================
// Part 2: the cycle allowlist -- the scaffold Phase 01.6.1 widens to
// TypeScript sources. Today it has exactly one recorded member: the live
// three-module cycle repo-root.mjs -> install-resources.mjs -> hostpath.mjs
// -> repo-root.mjs, surviving only because hostpath.mjs's own hop into
// repo-root.mjs (`repoRoot()`) is consumed by install-resources.mjs's
// hostLaunchInstructions(), which is itself called lazily from inside
// installResources() -- never at any of the three modules' own top level.
// ============================================================================

/** Flat module files directly under this directory (siblings, matching this
 * module tree's own flattened layout) -- test files excluded, since a test
 * importing its subject is not part of the PRODUCTION import graph this
 * check polices. */
function listModuleFiles(): string[] {
  return readdirSync(HERE, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => /\.(mjs|mts|cjs|ts|js)$/.test(name))
    .filter((name) => !name.includes(".test."));
}

/** Every relative import specifier `text` names, from BOTH shapes this
 * module tree actually uses: `import {...} from "./x"` (and `export {...}
 * from "./x"`, a re-export) and the bare side-effect form `import "./x"`
 * (vice-probe.mjs's own shape). Bounded to the flat directory's own siblings
 * -- every real specifier here is a `./name.ext` form, since scripts/ was
 * flattened away and nothing in this directory imports from a subdirectory
 * sibling.
 *
 * STATEMENT-ANCHORED, same reasoning as IMPORT_REPO_ROOT_PATTERN above and
 * for the identical reason: an unanchored `from\s+["'](\.[^"']+)["']` search
 * also matches a relative specifier quoted inside a comment -- exactly
 * install-resources.mjs's own header, which quotes `from "./repo-root.mjs"`
 * verbatim in prose. An unanchored version of this extractor was tried
 * first and produced a PHANTOM 2-node cycle (`install-resources.mjs` ->
 * `repo-root.mjs`) purely from that comment text, caught by this file's own
 * "module enumeration" sanity test failing in an unexpected shape --
 * anchoring to a real statement start (optional whitespace, then `import`/
 * `export`, never `//`) removes the phantom edge structurally. */
function extractRelativeImportSpecifiers(text: string): Set<string> {
  const specifiers = new Set<string>();
  for (const m of text.matchAll(/^[ \t]*(?:import|export)(?:\s+type)?\s+[^;]*?from\s+["'](\.[^"']+)["']/gm)) {
    specifiers.add(m[1]);
  }
  for (const m of text.matchAll(/^[ \t]*import\s+["'](\.[^"']+)["']/gm)) {
    specifiers.add(m[1]);
  }
  return specifiers;
}

/** Adjacency map: module basename -> array of module basenames it imports,
 * restricted to edges landing on another file in `moduleNames` (a specifier
 * resolving outside this flat set, e.g. into resources/ or a test file, is
 * simply not an edge in this graph). */
function buildImportGraph(moduleNames: string[]): Map<string, string[]> {
  const moduleSet = new Set(moduleNames);
  const graph = new Map<string, string[]>();
  for (const name of moduleNames) {
    const text = readFileSync(join(HERE, name), "utf8");
    const edges: string[] = [];
    for (const specifier of extractRelativeImportSpecifiers(text)) {
      const basename = specifier.split("/").pop()!;
      if (moduleSet.has(basename) && basename !== name) edges.push(basename);
    }
    graph.set(name, edges);
  }
  return graph;
}

/** Every SIMPLE cycle that includes `startNode`, found by a DFS rooted at
 * `startNode` itself -- fixing the rotation point this way means a directed
 * cycle through `startNode` is discovered exactly once (in the one
 * direction its edges actually run), rather than once per rotation. A path
 * that revisits some OTHER already-on-stack node before returning to
 * `startNode` is abandoned (not a cycle through startNode at this
 * traversal), matching this test's only concern: cycles that pass through
 * repo-root.mjs specifically. */
function findCyclesThroughNode(graph: Map<string, string[]>, startNode: string): string[][] {
  const cycles: string[][] = [];
  const stack = [startNode];
  const onStack = new Set([startNode]);

  function dfs(node: string): void {
    for (const next of graph.get(node) || []) {
      if (next === startNode) {
        cycles.push([...stack]);
      } else if (!onStack.has(next)) {
        stack.push(next);
        onStack.add(next);
        dfs(next);
        onStack.delete(next);
        stack.pop();
      }
    }
  }
  dfs(startNode);
  return cycles;
}

/** Canonicalizes each found cycle to its sorted member list (a cycle is
 * reported as the SET of modules participating in it, not as one specific
 * traversal order) and dedupes, so two different corners of a DFS finding
 * "the same" cycle collapse to one entry. */
function canonicalCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const cycle of cycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(sorted);
    }
  }
  out.sort((a, b) => a.join(",").localeCompare(b.join(",")));
  return out;
}

// The recorded allowlist. EMPTY as of 01.6.1-02 (PTD-1, locked by the
// developer; RESEARCH §3.4 Option B): the three-module cycle this array
// used to record (hostpath.mjs -> install-resources.mjs -> repo-root.mjs ->
// hostpath.mjs) was retired STRUCTURALLY -- hostpath.mjs no longer imports
// repo-root.mjs at all; it takes the workspace root as an optional argument
// instead. This array does not record that there is no cycle "for now"; it
// records that a new one is not allowed through silently. A future cycle
// through repo-root.mjs must be justified by amending this array in this
// same test, not discovered by accident. See 01.6.1-RESEARCH.md §3.4 for
// the retirement, and Part 3 below for the complementary call-site guard
// that survives the cycle's removal.
const ALLOWED_CYCLES_THROUGH_REPO_ROOT: string[][] = [];

test("cycle allowlist: module enumeration under .claude/mcp/vice/ returns a non-empty flat set", () => {
  const moduleNames = listModuleFiles();
  assert.ok(moduleNames.length > 0, "module enumeration returned nothing -- path resolution is broken, not a real pass");
  // Resolved by STEM (Task 1's own resolveModuleByStem(), reused here) rather
  // than a hardcoded extension -- so THIS sanity check does not go stale the
  // next time one of these three renames, exactly the failure mode Task 1
  // fixed for Part 1's real-file guard above.
  assert.ok(resolveModuleByStem("repo-root"), "expected a repo-root module to be part of the enumerated module set");
  assert.ok(resolveModuleByStem("install-resources"), "expected an install-resources module to be part of the enumerated module set");
  assert.ok(resolveModuleByStem("hostpath"), "expected a hostpath module to be part of the enumerated module set");
});

test("cycle allowlist: exactly the recorded three-module cycle passes through repo-root.mjs", () => {
  const moduleNames = listModuleFiles();
  const graph = buildImportGraph(moduleNames);
  // Resolved by STEM (Task 1's own resolveModuleByStem(), reused here), not the
  // literal "repo-root.mjs" -- 01.6.1-08's end-of-phase re-proof found this
  // hardcoded live: after 01.6.1-03 renamed repo-root.mjs to repo-root.ts, this
  // DFS was started from a node that no longer exists in the graph, so
  // findCyclesThroughNode() returned [] UNCONDITIONALLY and this assertion had
  // been vacuously passing since Plan 03 landed -- it could not have failed no
  // matter what cycle existed. Confirmed live via a scratch-copy regression
  // (see 01.6.1-08-SUMMARY.md Task 2 step B): reintroducing the cycle in a
  // scratch copy did NOT fail this test until this line was fixed.
  const cycles = canonicalCycles(findCyclesThroughNode(graph, resolveModuleByStem("repo-root")));

  assert.deepEqual(
    cycles,
    ALLOWED_CYCLES_THROUGH_REPO_ROOT,
    `the set of cycles through repo-root.mjs changed -- expected exactly ${JSON.stringify(ALLOWED_CYCLES_THROUGH_REPO_ROOT)}, ` +
      `got ${JSON.stringify(cycles)}. A NEW cycle through repo-root.mjs must be justified by amending ` +
      "ALLOWED_CYCLES_THROUGH_REPO_ROOT in this test, not silently allowed through on the same luck that " +
      "keeps today's recorded cycle from crashing (a lazy call site, not a structural guarantee). " +
      "Widening this allowlist to TypeScript sources, and deciding whether to break the cycle outright, " +
      "belong to Phase 01.6.1 criterion B and are not settled here."
  );
});

// ============================================================================
// Part 3: the module-scope call-site guard (01.6.1-02, RESEARCH §3.3/§3.5).
// Emptying the allowlist above retires the ONE cycle it recorded, but not
// the hazard CLASS: an unguarded module-scope repoRoot() call falls through
// to repo-root.mjs's own possibly-still-TDZ'd `HERE` regardless of whether
// an import cycle exists at all. This is why the guard is scoped to MODULE
// SCOPE, not "any call inside a listed cycle member" -- with the allowlist
// empty there is no cycle membership left to scope by, so a member-scoped
// guard would be vacuous the day it lands. A module-scope guard has a real
// subject today (containerpath.mjs's own top-level repoRoot() call) and
// gains a fresh at-risk subject the instant a future edit adds an unguarded
// module-scope repoRoot() call anywhere in this flat tree -- including
// inside vice-sync.mjs, which this same plan gave a repo-root import it did
// not have before (see that file's own header comment).
//
// moduleScopeRepoRootCalls() was written and exercised by its own
// regression corpus BEFORE it was implemented (RED, matching this file's
// own Part 1 red-then-green shape) -- confirmed live: both new tests failed
// with `ReferenceError: moduleScopeRepoRootCalls is not defined` before this
// function existed.
// ============================================================================

/** Every module-scope repoRoot(...) call found in `text`, as `{ line,
 * guarded }` objects. Anchored on the ABSENCE of leading whitespace: a
 * module-scope statement starts at column zero, a call inside any function
 * body is indented -- this matters because five of the seven real
 * repoRoot() call sites in this tree today are exactly that indented, lazy,
 * safe shape (01.6.1-RESEARCH.md's own measured table). Three column-zero
 * shapes are excluded, none of them calls: a line whose first non-whitespace
 * characters open a comment (`//` or `/*`), a continuation line of an
 * already-open block comment, and the repo-root module's own
 * `function repoRoot(` declaration line -- a declaration, not a call. */
interface ModuleScopeCall {
  line: string;
  guarded: boolean;
}

function moduleScopeRepoRootCalls(text: string): ModuleScopeCall[] {
  const results: ModuleScopeCall[] = [];
  let inBlockComment = false;
  for (const line of text.split("\n")) {
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    const trimmed = line.replace(/^[ \t]+/, "");
    if (trimmed !== line) continue; // indented -- function-body scope, not module scope
    if (trimmed.startsWith("//")) continue; // line comment
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue; // block-comment opener (single- or multi-line)
    }
    if (/^(?:export\s+)?(?:async\s+)?function\s+repoRoot\s*\(/.test(trimmed)) continue; // the declaration itself
    if (!/\brepoRoot\(/.test(trimmed)) continue;
    const guarded = /\brepoRoot\(\s*\{[^)]*?\bfrom\s*:/.test(trimmed);
    results.push({ line: trimmed, guarded });
  }
  return results;
}

test("moduleScopeRepoRootCalls(): regression corpus -- guarded vs. unguarded module-scope calls, indented calls ignored, the declaration itself and prose comments not classified as calls", () => {
  assert.deepEqual(
    moduleScopeRepoRootCalls('const WORKSPACE_ROOT = repoRoot({ from: HERE });'),
    [{ line: 'const WORKSPACE_ROOT = repoRoot({ from: HERE });', guarded: true }],
    "a module-scope declaration calling repoRoot() with an explicit `from:` key must be classified guarded"
  );
  assert.deepEqual(
    moduleScopeRepoRootCalls('const WORKSPACE_ROOT = repoRoot();'),
    [{ line: 'const WORKSPACE_ROOT = repoRoot();', guarded: false }],
    "a module-scope declaration calling repoRoot() with no arguments must be classified unguarded -- this " +
      "is exactly the regression 01.6.1-RESEARCH.md §3.2 reproduced live, crashing with " +
      '"Cannot access \'HERE\' before initialization"'
  );
  assert.deepEqual(
    moduleScopeRepoRootCalls('  const x = repoRoot();'),
    [],
    "an INDENTED (function-body) bare repoRoot() call is not module scope and must be ignored -- five of " +
      "the seven real call sites in this tree are exactly this shape and are safe (lazy, called well " +
      "after every module has finished evaluating)"
  );
  assert.deepEqual(
    moduleScopeRepoRootCalls('export function repoRoot({ from = HERE, env = process.env } = {}) {'),
    [],
    "the repo-root module's own exported function DECLARATION line -- column zero, contains the " +
      "identifier followed by an open parenthesis -- must not be classified as a call"
  );
  assert.deepEqual(
    moduleScopeRepoRootCalls('// import repoRoot()/supervisorDir()), among other modules in this tree,'),
    [],
    "a column-zero COMMENT line that merely mentions repoRoot() in prose must not be classified as a " +
      "call -- repo-root.mjs has exactly this line today (its own line 142), and an unanchored pattern " +
      "fires on it"
  );
});

/** Every module-scope repoRoot(...) call site, source-text only, across every
 * production module this phase converts. Iterates listModuleFiles()'s own
 * enumeration (not a hand-maintained list) so a future rename in this phase
 * needs no edit here, and asserts every module-scope call found is guarded --
 * naming the file and line on failure. */
function assertAllModuleScopeCallsGuarded() {
  const moduleNames = listModuleFiles();
  assert.ok(moduleNames.length > 0, "module enumeration returned nothing -- the guard cannot police an empty set");
  for (const name of moduleNames) {
    const text = readFileSync(join(HERE, name), "utf8");
    for (const { line, guarded } of moduleScopeRepoRootCalls(text)) {
      assert.ok(
        guarded,
        `${name}: module-scope call \`${line.trim()}\` does not pass an explicit \`from:\` override. ` +
          "An unguarded module-scope repoRoot() call falls through to repo-root.mjs's own " +
          "still-possibly-uninitialised `HERE` binding -- 01.6.1-RESEARCH.md §3.2 reproduced this LIVE, " +
          'crashing with exactly "Cannot access \'HERE\' before initialization". The cycle allowlist ' +
          "above being empty does not make this check redundant: 01.6.1-02's own cycle-break (Task 1) " +
          "gave vice-sync.mjs a repo-root import it did not have before, which is a fresh route to the " +
          "same hazard this guard exists to police."
      );
    }
  }
}

test("call-site guard: every module-scope repoRoot() call in the real production tree passes an explicit `from:`", () => {
  assertAllModuleScopeCallsGuarded();
});
