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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly, shippedTsModules } from "./shipped-modules.ts";
import { AnnoStorePathError } from "./anno-types.ts";
import { closeStore, openStore } from "./anno-store.ts";

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

/**
 * The DECLARED set of the seam's SEAM-PRIVATE-BY-CONVENTION exports: symbols
 * that are `export`ed only so a proof can drive the IDENTICAL production code
 * rather than a hand-copied variant of it, and that no shipped module may
 * reach for.
 *
 * `applyWriteWithoutCommit` exists so the durability proof's planted violation
 * ("remove the commit") runs the real write sequence; if it leaked into a
 * production module, a write could silently fail to commit.
 *
 * `stageSnapshot` exists for the same single reason -- the snapshot-OWNERSHIP
 * proof has to stage from the losing writer's position through the code the
 * winner uses -- and it carries the same class of risk if it leaked: a shipped
 * caller that staged a snapshot without ever publishing it would leave `.tmp`
 * files that no pointer row claims and that the reconciliation sweep is
 * deliberately anchored NOT to match, so nothing would ever clean them up.
 *
 * A DECLARED LIST rather than two copy-pasted tests, so a third such export is
 * one array entry and cannot be added without this list noticing.
 */
const SEAM_PRIVATE_EXPORTS = ["applyWriteWithoutCommit", "stageSnapshot"];

test("no shipped module other than the seam names ANY of the declared seam-private exports", () => {
  const others = shippedTsModules().filter((name) => name !== THE_ONE_SEAM);
  assert.ok(others.length > 10, `the comparison set must be non-empty, got ${others.length}`);

  // PAIRED WITH A LENGTH CHECK, for the same reason the test-tree scan below
  // is: a declared list that lost an entry would scan for nothing and every
  // deepEqual against [] would still pass. The count is the assertion that the
  // loop ran over the set it claims to cover.
  assert.equal(
    SEAM_PRIVATE_EXPORTS.length,
    2,
    `the declared seam-private export set must hold both members, got ${SEAM_PRIVATE_EXPORTS.length} -- a list that lost an entry scans ` +
      "for nothing and passes",
  );

  for (const exported of SEAM_PRIVATE_EXPORTS) {
    const leaked = others.filter((name) => codeOnly(readFileSync(join(HERE, name), "utf8")).includes(exported));
    // The message names the OFFENDING export from the loop variable rather
    // than hard-coding one of them: a singular noun standing over a two-element
    // scan is a claim the assertion does not make.
    assert.deepEqual(leaked, [], `the seam-private export ${exported} must not be reachable from any shipped module but the seam`);
  }
});

test("the seam-private export scan is NON-VACUOUS over the code this area added: all three staging transitions are present in the seam's own stripped source", () => {
  // The scan above is a filter for ABSENCE across other modules. Absence is
  // trivially satisfiable by scanning for a name nothing has -- including a
  // name the seam itself no longer has. This pins the other side: the symbols
  // exist in the module the guard is protecting.
  const kept = codeOnly(seamSource());
  for (const symbol of ["stageSnapshot", "publishSnapshot", "discardSnapshot"]) {
    assert.ok(kept.includes(symbol), `${symbol} must exist in the seam's stripped source, or the leak scan above is decoration`);
  }
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

/** Every commit STATEMENT in an (already stripped, LITERAL-BODIES-KEPT) source
 * text. ONE definition, used by the seam assertion below and by both fixture
 * controls, so the coverage the fixtures prove is the coverage the seam
 * assertion gets -- never two matchers that can drift apart. */
function commitStatements(source: string): string[] {
  // An `exec()` call whose SINGLE argument is a bare statement literal, in any
  // of the three spellings SQLite treats as the same statement, under any of
  // the three quote characters, tolerant of whitespace inside and around the
  // literal. Anything that is not that shape -- an identifier, an interpolated
  // string, a sentence in an error message -- is not a commit statement and is
  // not counted.
  return source.match(/\bexec\(\s*(['"`])\s*(?:commit|end(?:\s+transaction)?)\s*\1\s*\)/gi) ?? [];
}

/** All three spellings SQLite accepts for the SAME statement, as a LOCAL
 * fixture rather than as a slice of the module: the module happens to contain
 * one spelling, so a matcher checked only against it proves nothing about the
 * other two. */
const THREE_SPELLINGS_FIXTURE = [
  '  db.exec("commit");',
  "  db.exec('end');",
  '  db.exec("END TRANSACTION");',
].join("\n");

/** Everything that names a commit WITHOUT being one: the module's three
 * commit-ish identifiers, and a user-facing sentence using the bare word. The
 * second half is the part that matters -- a matcher that fires on prose makes
 * an error message's wording load-bearing for a control in another file. */
const NO_STATEMENT_FIXTURE = [
  "  commitTransaction(handle.db);",
  "  applyWriteWithoutCommit(handle, fn);",
  "  const done = doCommit;",
  '  step: "the commit could not be completed",',
].join("\n");

test("the seam contains exactly one commit statement, so the single planted-violation site is unique", () => {
  // Literal bodies KEPT: the commit statement IS a string literal, and
  // stripping literals would make this assertion vacuous. Comments are still
  // stripped, so the header's prose about the commit cannot inflate the count.
  //
  // WR-15, and this is the defect being closed: the matcher used to count the
  // WORD `commit`, and SQLite accepts `END` and `END TRANSACTION` as exact
  // synonyms of `COMMIT`. A second, fully working commit site spelled
  // `db.exec("end")` was therefore invisible to the one control whose whole job
  // is keeping the durability proof's planted violation unique -- observed
  // passing, unchanged, with that site present. The matcher now requires an
  // `exec()` call whose single argument is a bare statement literal in any of
  // the three spellings, which is what SQLite executes; `commitTransaction`,
  // `applyWriteWithoutCommit`, `doCommit` and any user-facing sentence about a
  // commit cannot satisfy that shape, so no error message's wording is coupled
  // to this control any more.
  const kept = codeOnly(seamSource(), true);
  const found = commitStatements(kept);
  assert.equal(
    found.length,
    1,
    `the seam must contain exactly one commit statement, found ${found.length} -- a second one splits the durability ` +
      `proof's planted violation across two sites and lets half of it survive`,
  );
});

test("the commit-statement matcher counts all three of SQLite's spellings, so a synonym cannot hide a second commit site", () => {
  // Positive control over a LOCAL fixture: the matcher's coverage is asserted
  // rather than inferred from a module that happens to contain one spelling.
  // Against the word-based matcher this fixture yielded ONE -- which is exactly
  // how a working `db.exec("end")` survived the control.
  const found = commitStatements(THREE_SPELLINGS_FIXTURE);
  assert.equal(
    found.length,
    3,
    `all three commit spellings must be counted, got ${found.length} of 3 -- an uncounted spelling is a second commit site the ` +
      `single-site control cannot see`,
  );
});

test("the commit-statement matcher counts neither commit-ish identifiers nor user-facing prose about a commit", () => {
  // Negative control, and the reason the coupling comment in `anno-store.ts`
  // could be deleted: with prose unmatched, an error message's wording is free
  // to change without reddening a structural control in a different file.
  const found = commitStatements(NO_STATEMENT_FIXTURE);
  assert.equal(
    found.length,
    0,
    `identifiers and prose must not be counted as commit statements, got ${found.length} -- a matcher that fires on wording makes ` +
      `error prose load-bearing for a control in another file`,
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

// ---------------------------------------------------------------------------
// WR-25 -- `openStore`'s unconfined ESCAPE HATCH, pinned to its enumerated
// sites in the SEAM_PRIVATE_EXPORTS style.
//
// Confinement became `openStore`'s default in 28-21, and the escape is what
// keeps the module's own derived-path opens working. An escape that spreads
// silently is the old unsafe default returning by another name, which is why
// this pin exists at all and why it asserts a POSITIVE count rather than only
// an absence.
// ---------------------------------------------------------------------------

/** The literal a CALL SITE spells when it asks for the unconfined path. The
 * option's declaration (`unconfinedModuleDerivedPath?: boolean`) and the
 * guard's own read (`opts.unconfinedModuleDerivedPath !== true`) deliberately
 * do NOT match this, so the count below counts uses and not mentions. */
const ESCAPE_AT_A_CALL_SITE = "unconfinedModuleDerivedPath: true";

/**
 * The enumerated module-derived opens inside the seam, read off the code at
 * plan time and asserted here so a fifth one cannot arrive unnoticed:
 *   1. `snapshotOpenFailure`'s judging open of `snapshotPathFor(handle, revision)`
 *   2. `revertTo` step 3b's open of the staged copy
 *   3. `revertTo` step 6's reopen after the rename
 *   4. `revertTo` step 6's second reopen, on the failed-sweep recovery path
 */
const ENUMERATED_DERIVED_OPENS = 4;

test("WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens", () => {
  // STRICT `codeOnly()` (literal bodies BLANKED, the default): the option's own
  // name appears inside `openStore`'s refusal MESSAGE, and a guard that counted
  // that would be counting prose. This is the same reason the extension-loading
  // gate above uses strict mode.
  const seamCode = codeOnly(seamSource());

  // THE POSITIVE COUNT IS THE PRIMARY ASSERTION -- it states what must be true
  // rather than only what must be absent, so a rename that made every scan below
  // find nothing cannot pass this test.
  const uses = seamCode.split(ESCAPE_AT_A_CALL_SITE).length - 1;
  assert.equal(
    uses,
    ENUMERATED_DERIVED_OPENS,
    `the seam must ask for the unconfined path at exactly its ${ENUMERATED_DERIVED_OPENS} enumerated module-derived opens, found ${uses} -- ` +
      "a fifth use is either a new derived-path open that belongs in the enumeration above, or the old unsafe default returning by another name",
  );

  const others = shippedTsModules().filter((name) => name !== THE_ONE_SEAM);
  assert.ok(others.length > 10, `the comparison set must be non-empty, got ${others.length}`);
  const leaked = others.filter((name) => codeOnly(readFileSync(join(HERE, name), "utf8")).includes("unconfinedModuleDerivedPath"));
  assert.deepEqual(
    leaked,
    [],
    "no shipped module other than the seam may name the unconfined escape at all -- a path a consumer supplied is never a path this module derived",
  );
});

test("WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped source still contains openStore", () => {
  // The absence half above is trivially satisfied by an empty or unreadable
  // scan, and the count half is trivially satisfied by a source that was never
  // read. Both sides are pinned here.
  const scanned = shippedTsModules();
  assert.ok(scanned.length > 10, `the shipped module set must be substantial, got ${scanned.length}`);
  assert.ok(scanned.includes(THE_ONE_SEAM), `the scanned set must contain ${THE_ONE_SEAM}, or the count above scanned nothing`);

  const seamCode = codeOnly(seamSource());
  assert.ok(seamCode.includes("openStore"), "openStore must exist in the seam's stripped source, or the pin above is decoration");
});

test("WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied", () => {
  // ASSERTED THROUGH THE ENTRY POINT, NOT AGAINST SOURCE TEXT, and that is
  // deliberate: prohibition 28-18 P1 forbids a structural invariant from
  // constraining the wording of a user-facing message, and a source-text match
  // on the refusal is one edit away from doing exactly that. The pin above is
  // structural because it counts CALL SITES; this one is behavioural because it
  // is about what the function DOES.
  const dir = mkdtempSync(join(tmpdir(), "anno-seam-"));
  try {
    const path = join(dir, "proj.annostore");

    let caught: unknown;
    try {
      openStore(path);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof AnnoStorePathError, `an unconfined open with no escape must be refused by name; got ${caught}`);
    assert.equal(existsSync(path), false, "and the refusal must precede creation -- nothing exists at the refused path");

    // AND THE ESCAPE STILL WORKS, so the guard is a gate and not a wall.
    const handle = openStore(path, { unconfinedModuleDerivedPath: true });
    closeStore(handle);
    assert.equal(existsSync(path), true, "the escape opens the same path and creates the store");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
