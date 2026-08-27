// anno-seam.test.ts -- the structural assertion that STORE-07's confinement is
// REAL rather than promised: `node:sqlite` is named by exactly ONE module of
// the shipped module set, all four of its working access routes are proven
// catchable by the one predicate the real scan uses, and a comment-only
// mention is proven not to count.
//
// Modelled on `hostpath-consumers.test.ts`, which established this idiom, and
// diverging from it in exactly TWO places -- both stated below, because a
// divergence a reader has to infer is a divergence a later edit will undo by
// accident.
//
// Nothing here asserts that stderr is empty, and nothing may: `node:sqlite`
// emits an `ExperimentalWarning` unconditionally on first load.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly, shippedTsModules } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The one module allowed to name the persistence dependency. */
const THE_ONE_SEAM = "anno-store.ts";

/** The three shipped modules this area adds. */
const NEW_SHIPPED_MODULES = ["anno-types.ts", "anno-index.ts", "anno-store.ts"];

/**
 * The DECLARED set of TEST files whose code names the persistence dependency.
 *
 * WHY A SECOND DECLARED SET EXISTS AT ALL. `STORE-07`'s assertion above scans
 * `shippedTsModules()`, which is `package.json`'s `files[]` filtered to
 * `.ts`/`.mts` -- and no test file is ever in `files[]` (asserted further
 * down). So the test tree is OUTSIDE that guard's scope BY CONSTRUCTION, and
 * "outside the scope of the guard" is precisely how a dependency spreads
 * unnoticed: every new store test is a place someone could reach for
 * `DatabaseSync` directly rather than through the seam's entry points, and
 * nothing above would say a word. A declared list closes it -- not by
 * forbidding the import outright, but by making each instance a deliberate,
 * reviewed edit to THIS array.
 *
 * WHY THE MEMBER IS THIS FILE, AND WHY IT IS THE ONLY ONE. Plan 28-06 expected
 * `anno-store.test.ts` to need the import for one corrupt fixture -- a
 * `schema_version` set to a value the store deliberately exposes no way to
 * write. MEASURED FALSE: `AnnoStoreHandle` exposes its own `db`, so that
 * fixture is one `UPDATE` through the open handle and needs no second importer
 * at all. The store tests therefore mention the specifier only in prose, which
 * `codeOnly()` strips.
 *
 * This file is the one member, and it is UNAVOIDABLE rather than incidental:
 * the four planted access routes above are STRING LITERALS containing the
 * specifier, and a specifier scan must run with `keepLiteralBodies = true`
 * (see `namesNodeSqlite`), which is exactly what makes a literal
 * indistinguishable from route (d)'s argument. That is the trade DIVERGENCE 2
 * already records, seen from the other side: the guard cannot exempt itself
 * without blinding itself.
 */
const TEST_FILES_NAMING_SQLITE = ["anno-seam.test.ts"];

/**
 * True iff the (already `codeOnly`-stripped, LITERAL-BODIES-KEPT) source names
 * the SQLite builtin.
 *
 * DIVERGENCE 1 FROM `hostpath-consumers.test.ts`: this is a single SUBSTRING
 * test, not a pair of import regexes. The reason is a measured property of the
 * dependency rather than a shortcut. `node:sqlite` has FOUR working access
 * routes:
 *
 *   (a) a static `import ... from "node:sqlite"`;
 *   (b) the same, spread across several lines;
 *   (c) a dynamic `await import("node:sqlite")`;
 *   (d) `process.getBuiltinModule("node:sqlite")` -- and, equivalently,
 *       `createRequire(...)("node:sqlite")`.
 *
 * Only the PREFIXED specifier resolves: a bare `sqlite` specifier fails with
 * `ERR_MODULE_NOT_FOUND`. So every route that can actually reach the module
 * must spell the literal `node:sqlite` somewhere, and one substring test over
 * stripped source catches all four at once. Reproducing the two-regex idiom
 * would see (a) and (c) and be BLIND to (b)'s odd shapes and to (d) entirely
 * -- and (d) is the route someone reaches for precisely when they want to
 * avoid an import statement.
 *
 * `keepLiteralBodies = true` is mandatory at every call site, because the
 * thing being searched for IS a string literal. `shipped-modules.ts:198-205`
 * documents that mode as existing for exactly this caller shape.
 *
 * This is ONE named predicate, called by the real consumer-set scan AND by
 * every planting below, so there is exactly one definition of "counts as
 * naming the module" -- the discipline `hostpath-consumers.test.ts:64-70`
 * records: a structural test and its own proof must SHARE the checked logic,
 * never each carry a copy that can drift.
 */
function namesNodeSqlite(strippedSrc: string): boolean {
  return strippedSrc.includes("node:sqlite");
}

/** Strip a raw source the way the real scan does, so a planting goes through
 * the identical pipeline. */
function stripForSpecifierScan(src: string): string {
  return codeOnly(src, true);
}

/**
 * Every module of the SHIPPED module set whose code names `node:sqlite`.
 *
 * The scanned set is `shippedTsModules()` -- NOT a local `readdirSync`.
 * `STORE-07` is about the shipped module set, and that helper THROWS
 * `ShippedFilesEntryMissingError` when a `files[]` entry is not on disk, so the
 * scanned set cannot silently shrink and let this assertion pass by scanning
 * fewer files than it thinks.
 */
function sqliteImporters(): string[] {
  return shippedTsModules()
    .filter((name) => namesNodeSqlite(stripForSpecifierScan(readFileSync(join(HERE, name), "utf8"))))
    .sort();
}

// ---------------------------------------------------------------------------
// 1. The real assertion
// ---------------------------------------------------------------------------

test("node:sqlite is named by exactly one module of the shipped module set (STORE-07)", () => {
  const importers = sqliteImporters();
  // The pairing `hostpath-consumers.test.ts:143-150` established: the
  // deepEqual catches a WRONG NAME, and the length catches a BROKEN SCAN that
  // returned [] -- which a deepEqual against a one-element array would also
  // fail, but a deepEqual against [] would not, and refactors move that goal
  // post. Both, always.
  assert.deepEqual(importers, [THE_ONE_SEAM], "exactly one shipped module may name the SQLite builtin");
  assert.equal(importers.length, 1);
});

// ---------------------------------------------------------------------------
// 2-5. The four planted access routes, all through the same predicate
// ---------------------------------------------------------------------------

test("planted violation, route (a): a single-line static import is reported by the same predicate the real scan uses", () => {
  const planted = 'import { DatabaseSync } from "node:sqlite";\nexport function useIt() { return DatabaseSync; }\n';
  assert.equal(
    namesNodeSqlite(stripForSpecifierScan(planted)),
    true,
    "if this fails, the assertion above cannot catch a real second importer and is decoration",
  );
});

test("planted violation, route (b): a multi-line static import whose keyword, binding and specifier land on different lines is reported", () => {
  // The shape a per-line match can never see, because no single line contains
  // both the `import` keyword and the specifier.
  const planted = ["import {", "  DatabaseSync,", "  StatementSync,", '} from "node:sqlite";', "", "export function useIt() {}", ""].join("\n");
  assert.equal(namesNodeSqlite(stripForSpecifierScan(planted)), true, "a multi-line static import must be reported");
});

test("planted violation, route (c): a dynamic import() is reported", () => {
  const planted = 'export async function useIt() {\n  const { DatabaseSync } = await import("node:sqlite");\n  return DatabaseSync;\n}\n';
  assert.equal(namesNodeSqlite(stripForSpecifierScan(planted)), true, "a dynamic import of the builtin must be reported");
});

test("planted violation, route (d): process.getBuiltinModule -- the route a two-regex import detector cannot see -- is reported", () => {
  const planted = 'export function useIt() {\n  const sqlite = process.getBuiltinModule("node:sqlite");\n  return sqlite;\n}\n';
  assert.equal(
    namesNodeSqlite(stripForSpecifierScan(planted)),
    true,
    "getBuiltinModule reaches the module with no import statement at all -- this is the route the wider detector exists for",
  );
});

// ---------------------------------------------------------------------------
// 6. The negative control -- comment half only, and the trade is recorded
// ---------------------------------------------------------------------------

test("negative control: a source whose ONLY mention of the specifier is inside a // comment is NOT reported", () => {
  const commentOnly = [
    "// This module must never name the SQLite builtin: node:sqlite is confined",
    "// to one seam, and this comment is exactly the kind of prose that must not",
    "// redden the gate.",
    "export function useIt() { return 1; }",
    "",
  ].join("\n");
  assert.equal(
    namesNodeSqlite(stripForSpecifierScan(commentOnly)),
    false,
    "the detector must not turn into a raw whole-file substring search -- this module's own header discusses the specifier in prose",
  );

  // DIVERGENCE 2, AND THE TRADE IT COSTS. `hostpath-consumers.test.ts:231-262`
  // gives its control TWO halves: a `//` comment mention and a STRING LITERAL
  // mention, and asserts neither is reported. The string-literal half is
  // DELIBERATELY ABSENT here and cannot be added, because `keepLiteralBodies =
  // true` is required for a specifier scan -- with literal bodies kept, a bare
  // specifier inside a string literal is INDISTINGUISHABLE from the argument to
  // `process.getBuiltinModule`, which is route (d) above and a real violation.
  //
  // So this is the wider-detector / weaker-control side of a genuine trade.
  // `hostpath-consumers.test.ts` took the narrower side -- two regexes, two
  // control halves -- and its own doc comment explains why that was right for
  // the two routes it faces. Here there are four routes, two of which that
  // idiom cannot see at all, and four routes caught is worth more than a second
  // control half. Recording the trade in both directions is the point: a later
  // reader comparing the two files must not read this as an oversight.
});

// ---------------------------------------------------------------------------
// 7-8. Non-vacuity: the scanned set and the shipped list are real
// ---------------------------------------------------------------------------

test("non-vacuity: the scanned shipped module set is non-empty and contains all three new modules", () => {
  const scanned = shippedTsModules();
  assert.ok(scanned.length > 10, `the shipped module set must be substantial, got ${scanned.length}`);
  for (const name of NEW_SHIPPED_MODULES) {
    assert.ok(scanned.includes(name), `${name} must be in the scanned set, or the single-seam assertion above is vacuous`);
  }
});

test("package.json files[] ships the three modules and no anno-prefixed test file or test-only helper", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  for (const name of NEW_SHIPPED_MODULES) {
    assert.equal(
      pkg.files.includes(name),
      true,
      `${name} must be listed: STORE-07's assertion scans a set derived from files[], so an unlisted module makes it vacuous`,
    );
  }
  const annoEntries = pkg.files.filter((entry) => entry.startsWith("anno-")).sort();
  assert.deepEqual(
    annoEntries,
    [...NEW_SHIPPED_MODULES].sort(),
    "the shipped set must contain exactly the three modules -- no test file, and no test-only spawned helper",
  );
  assert.equal(
    pkg.files.some((entry) => /\.test\./.test(entry)),
    false,
    "no test file may ever be listed in files[]",
  );
});

// ---------------------------------------------------------------------------
// 9-12. Properties of the one seam module itself
// ---------------------------------------------------------------------------

/** The seam's raw source, read once per test that needs it. */
function seamSource(): string {
  return readFileSync(join(HERE, THE_ONE_SEAM), "utf8");
}

test("the seam never touches SQLite's extension-loading surface", () => {
  // STRICT `codeOnly()` here (literal bodies BLANKED, the default), not the
  // specifier mode used above: these are CODE IDENTIFIERS and a constructor
  // option name, not specifiers, so the seam's own header prose discussing them
  // must not be able to redden this gate.
  const strict = codeOnly(seamSource());
  for (const forbidden of ["loadExtension", "enableLoadExtension", "allowExtension"]) {
    assert.equal(
      strict.includes(forbidden),
      false,
      `${forbidden} must never appear in the seam's code: both methods are present on DatabaseSync.prototype and the constructor ` +
        `option enables them, so either one turns this module's caller-supplied FILE ARGUMENT into arbitrary code loading`,
    );
  }
});

test("the seam declares no module-level mutable binding, including a const bound to a mutable container", () => {
  // Adapted from `block-class.test.ts:194-212`, keeping the half that matters
  // and making one deliberate change.
  //
  // KEPT IN FULL: the `const`-bound-mutable-container half. A `let`-only grep
  // let the likeliest real offender straight through when that scan was first
  // written -- `const seen = new Map()` is a memoising cache, IS module-level
  // mutable state, is exactly what someone reaches for to speed up a scan, and
  // is `const`. That half must never be weakened back.
  //
  // CHANGED: the patterns are anchored at COLUMN ZERO here. `block-class.ts`
  // is a module whose functions hold no local state at all, so anchoring made
  // no difference to it; this seam has function bodies with genuine locals
  // (`let meta`, `let touched`). The requirement is about MODULE-LEVEL state --
  // so that each `DatabaseSync` handle is owned by its caller and two
  // concurrent callers cannot observe each other's connection state -- and the
  // anchor is what makes the scan mean that, instead of "no local variable
  // anywhere", which would be a different and wrong rule.
  const strict = codeOnly(seamSource());
  const offenders = strict
    .split("\n")
    .filter((line) => /^(let|var)\s/.test(line) || /^const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line));
  assert.deepEqual(offenders, [], "every handle is owned by its caller; the seam holds nothing between calls");
});

test("no shipped module other than the seam names the no-commit write wrapper", () => {
  // The wrapper exists only so a durability proof's planted violation drives
  // the IDENTICAL code path as the real write. Its one caller is a spawned,
  // test-only helper outside files[]. If it ever leaked into a production
  // module, a write could silently fail to commit.
  const others = shippedTsModules().filter((name) => name !== THE_ONE_SEAM);
  assert.ok(others.length > 10, `the comparison set must be non-empty, got ${others.length}`);
  const leaked = others.filter((name) => codeOnly(readFileSync(join(HERE, name), "utf8")).includes("applyWriteWithoutCommit"));
  assert.deepEqual(leaked, [], "the no-commit write wrapper must not be reachable from any shipped module but the seam");
});

test("idempotency: re-running the scan over an unchanged tree yields the identical one-element importer list", () => {
  // The scan must be a PURE FUNCTION of shippedTsModules() and the files'
  // contents, with no cached state between runs. If it ever memoised, a second
  // run could report a stale answer -- and the run that matters is the one
  // after somebody adds a second importer.
  const first = sqliteImporters();
  const second = sqliteImporters();
  const third = sqliteImporters();
  assert.deepEqual(second, first, "a second run over an unchanged tree must produce the identical list");
  assert.deepEqual(third, first, "and so must a third");
  assert.deepEqual(first, [THE_ONE_SEAM], "and the list is still the one-element list, not an accumulated one");
  assert.notEqual(second, first, "each run must return a FRESH array, not a shared cached one a caller could mutate");
});

test("the revision compare-and-swap is structurally intact: begin immediate, an UPDATE guarded on the current revision, and a changes count that must equal 1", () => {
  // Structural, from the seam's own source, because the three parts fail
  // SEPARATELY and quietly: drop `begin immediate` and the snapshot pointer row
  // stops being atomic with the mutation; drop the `revision = ?` guard and a
  // concurrent writer's edit is overwritten; drop the changes check and a
  // no-op UPDATE reads as a successful write. Strict mode would blank the SQL
  // literals, so literal bodies are kept and comments are still stripped.
  const kept = codeOnly(seamSource(), true);
  assert.match(kept, /begin immediate/, "the write sequence must take the write lock up front");
  assert.match(
    kept,
    /update anno_meta set revision = revision \+ 1 where id = 1 and revision = \?/,
    "the revision must be advanced by a compare-and-swap guarded on the revision the caller read",
  );
  assert.match(kept, /changes\) !== 1|changes !== 1/, "the CAS must require exactly one changed row -- a no-op UPDATE is a lost write");
  assert.match(kept, /rollback/, "and must roll back rather than leaving the transaction open when it refuses");
});

test("the seam contains exactly one commit statement, so the single planted-violation site is unique", () => {
  // Literal bodies KEPT: the commit statement IS a string literal. Comments are
  // still stripped, so the header's prose about the commit cannot inflate the
  // count. `commitTransaction`, `applyWriteWithoutCommit` and `doCommit` are
  // not matched -- the word boundary requires a non-word character after
  // `commit`.
  const kept = codeOnly(seamSource(), true);
  const commitStatements = kept.match(/\bcommit\b/gi) ?? [];
  assert.equal(
    commitStatements.length,
    1,
    `the seam must contain exactly one commit statement, found ${commitStatements.length} -- a second one splits the durability ` +
      `proof's planted violation across two sites and lets half of it survive`,
  );
});

// ---------------------------------------------------------------------------
// 13. The same confinement, bounded over the TEST tree
// ---------------------------------------------------------------------------

/** Every `*.test.*` file in this directory whose CODE names the dependency,
 * through the SAME `namesNodeSqlite` predicate and the SAME strip pipeline the
 * shipped-set scan uses. One definition of "counts as naming the module",
 * never two that can drift -- the discipline the predicate's own doc comment
 * records, applied to the second scanned set. */
function testFilesNamingSqlite(): string[] {
  return readdirSync(HERE)
    .filter((name) => /\.test\.[a-zA-Z0-9]+$/.test(name))
    .filter((name) => namesNodeSqlite(stripForSpecifierScan(readFileSync(join(HERE, name), "utf8"))))
    .sort();
}

test("node:sqlite is bounded in the TEST tree too: the set of test files naming it is a DECLARED list", () => {
  const scanned = readdirSync(HERE).filter((name) => /\.test\.[a-zA-Z0-9]+$/.test(name));
  // Non-vacuity FIRST: a scan that found no test files at all would satisfy any
  // deepEqual against a list it also failed to populate.
  assert.ok(scanned.length > 50, `the scanned test-file set must be substantial, got ${scanned.length}`);
  assert.ok(scanned.includes("anno-store.test.ts"), "the store's own test file must be inside the scanned set, or this assertion is decoration");

  const namers = testFilesNamingSqlite();
  // The same pairing as the shipped-set assertion, for the same reason: the
  // deepEqual catches a WRONG NAME and the length catches a BROKEN SCAN that
  // returned [] -- which a deepEqual against a one-element array would also
  // fail, but which a later refactor to a shorter expected list would not.
  assert.deepEqual(
    namers,
    TEST_FILES_NAMING_SQLITE,
    "a test file naming the SQLite builtin must be a declared, reviewed member of TEST_FILES_NAMING_SQLITE -- the shipped-set scan above " +
      "cannot see the test tree, and a store test reaching for DatabaseSync directly rather than through the seam is exactly how the " +
      "dependency spreads where no guard is looking",
  );
  assert.equal(namers.length, 1);
});

test("non-vacuity of the test-tree scan: a planted test file naming the specifier IS reported by the same predicate", () => {
  // The scan above is a filter over real files, so its non-vacuity has to be
  // shown on a synthetic source rather than by adding a real violation. Same
  // predicate, same strip pipeline as the real scan and as routes (a)-(d).
  const planted = 'import { DatabaseSync } from "node:sqlite";\ntest("x", () => new DatabaseSync(":memory:"));\n';
  assert.equal(
    namesNodeSqlite(stripForSpecifierScan(planted)),
    true,
    "if a planted test-side importer is not reported, the declared list above cannot catch a real one and is decoration",
  );

  const clean = "// a store test that goes through the seam's own entry points, as every one of them must\nimport { openStore } from './anno-store.ts';\n";
  assert.equal(namesNodeSqlite(stripForSpecifierScan(clean)), false, "and a test file that only goes through the seam must not be reported");
});
