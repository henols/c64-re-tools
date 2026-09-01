// module-classification.test.ts
//
// WHY THIS FILE EXISTS (SEAM-02): `module-classification.ts` records which
// modules in the rented-analyser family are capabilities and which are glue.
// A prose document would do the same job and then go stale with nothing
// failing. This file is what turns that record into an OBLIGATION: it
// enumerates the declared scope from disk and fails, naming the file, the
// moment a module in scope has no entry or an entry has no module.
//
// NINE DIRECTIONS, each extracted into a NAMED PREDICATE that the real scan
// and the planted-violation test both call. That sharing is the property
// that makes this guard trustworthy and it is already the established shape
// in this suite (`hostpath-consumers.test.ts`'s planted-violation tests do
// exactly this): a planted violation that re-implements the rule proves
// nothing about the rule the real scan applies.
//
//   1. completeness      -- every in-scope path on disk has an entry
//   2. no orphans        -- every in-enumeration entry's module is on disk
//   3. basis integrity   -- basis non-empty, cited paths exist, ids well-shaped
//   4. name prohibition  -- no basis justifies a verdict by the module's name
//   5. verdict coherence -- extractables non-empty IFF the third verdict
//   6. non-vacuity       -- a DERIVED relation, never a pinned total
//   7. adjacency         -- no two entries name one module
//   8. ordering          -- same results over a reversed copy of the array
//   9. line citations    -- an advisory line is verified, never trusted
//
// THE `note` FIELD IS DELIBERATELY EXEMPT FROM DIRECTION 4, and the
// distinction matters: a `note` legitimately DISCUSSES the naming hazard
// this whole record exists to remove (one entry's note explains that a
// requirement clause looks as though it belonged to a different module
// because of what the modules are called). A guard that could not tell a
// justification from a caveat would force the record to go silent about
// exactly the thing it is for. So Direction 4 scans `basis` only -- every
// consumer path, every symbol, every requirement id and the rationale -- and
// never the note.
//
// DIRECTION 6 IS THE ONE TO GET RIGHT. Its threshold is DERIVED from the
// registry, never written as a literal. See the reasoning recorded at the
// assertion itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODULE_CLASSIFICATION, classificationFor } from "./module-classification.ts";
import type { ModuleClassificationEntry } from "./module-classification.ts";
import { repoRoot } from "./repo-root.ts";
import { shippedTsModules } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

/**
 * The registry's DECLARED in-enumeration scope, derived from disk and
 * filtered EXPLICITLY rather than incidentally: files in this directory
 * whose name begins with the analyser family's own segment, ending `.ts` or
 * `.json`, excluding every `*.test.*` file.
 *
 * The `.json` half is a DECISION, not an accident. The family contains one
 * generated data file, it matches the family's naming, and an unfiltered
 * enumeration would demand an entry for it by accident rather than by
 * intent. Including it deliberately -- and comparing filenames as EXACT
 * strings including the extension, so it is matched by its full filename and
 * never by a stem -- is what makes the record's coverage of it a stated
 * choice.
 *
 * `dir` is injectable purely so the ordering direction and the planted
 * violations can drive this same code path against synthetic inputs. Real
 * callers pass nothing.
 */
/** The retired analyser family's filename prefix. Every module that ever
 * carried it has been renamed into the `anno-` namespace or deleted, so this
 * matches nothing on disk -- which is the enumeration emptying as designed,
 * not a broken glob. DIRECTION 6 still catches a broken glob via
 * `disk.length >= entries.length`. */
const RETIRED_PREFIX = "retired-analyser-";

function inEnumerationOnDisk(dir: string = HERE): string[] {
  return readdirSync(dir)
    // STILL the RETIRED prefix, and that is the re-pointing rather than an
    // oversight (plan 29-05). The enumeration's subject is WHAT REMAINS IN
    // SCOPE -- the modules still awaiting a fate -- not the family as it was
    // named. Nine capabilities and the CLI moved out from under this prefix
    // and their entries became `discharged`; widening this filter to follow
    // them into the surviving `anno-` namespace would re-import survivors
    // into a scope whose whole purpose is to empty, and would make
    // DIRECTION 6's completeness half report a growing set while the real one
    // shrank. That enumeration HAS now legitimately reached zero -- no file
    // under the retired prefix remains on disk -- so the non-vacuity that
    // used to rest on `disk.length > 0` rests on the discharge-closure
    // relation instead, exactly as planned below.
    .filter((name) => name.startsWith(RETIRED_PREFIX))
    .filter((name) => /\.(ts|json)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name))
    .sort();
}

/** The entries the disk-completeness relation applies to. */
function inEnumerationEntries(entries: readonly ModuleClassificationEntry[]): ModuleClassificationEntry[] {
  return entries.filter((entry) => entry.scope === "in-enumeration");
}

/** The entries whose fate has been carried out. */
function dischargedEntries(entries: readonly ModuleClassificationEntry[]): ModuleClassificationEntry[] {
  return entries.filter((entry) => entry.scope === "discharged");
}

/** THE DISCHARGE-CLOSURE RELATION (plan 29-05). Everything wrong with the
 * discharged half of the registry, as a list of named offences:
 *
 *   - a discharged entry with no `fate` at all -- the scope says something
 *     happened and the record does not say what;
 *   - a `renamed` fate whose `to` is not on disk -- which is precisely how a
 *     rename gets RECORDED without HAPPENING, and is the failure this
 *     relation exists to make loud;
 *   - a `renamed` fate whose `from` equals its `to` -- a move that moved
 *     nothing, recorded as though it had;
 *   - a `deleted` fate whose module IS still on disk -- a deletion recorded
 *     against a file that survived it.
 *
 * Extracted into ONE named predicate that the real scan and the planted
 * violation both call, like every other direction in this file. `here` is
 * injectable so the planted violation drives this same code path. */
function dischargeClosureProblems(entry: ModuleClassificationEntry, here: string = HERE): string[] {
  const problems: string[] = [];
  const fate = entry.fate;
  if (fate === undefined) {
    problems.push(`${entry.module}: scope is "discharged" but the entry records no fate -- what happened to it is unstated`);
    return problems;
  }
  if (fate.kind === "renamed") {
    if (fate.from === fate.to) {
      problems.push(`${entry.module}: fate is a rename from ${fate.from} to itself -- a move that moved nothing`);
    }
    if (!existsSync(join(here, fate.to))) {
      problems.push(
        `${entry.module}: fate names a rename to ${fate.to}, which is NOT on disk -- a fate naming a path that ` +
          "is not there is how a rename gets recorded without happening",
      );
    }
    return problems;
  }
  if (existsSync(join(here, entry.module))) {
    problems.push(
      `${entry.module}: fate says it was deleted on ${fate.on}, but the file is still on disk -- a deletion ` +
        "recorded against a file that survived it",
    );
  }
  return problems;
}

/** DIRECTION 1. Every in-scope path on disk that has no registry entry.
 * Returns the offending filenames so the failure message can name them --
 * a module added later cannot slip in unclassified. */
function unclassifiedModules(entries: readonly ModuleClassificationEntry[], diskModules: readonly string[]): string[] {
  const classified = new Set(inEnumerationEntries(entries).map((entry) => entry.module));
  return diskModules.filter((name) => !classified.has(name));
}

/** DIRECTION 2. Every in-enumeration entry whose module is not on disk --
 * the leftover an entry becomes after a rename or a deletion. */
function orphanedEntries(entries: readonly ModuleClassificationEntry[], diskModules: readonly string[]): string[] {
  const onDisk = new Set(diskModules);
  return inEnumerationEntries(entries)
    .filter((entry) => !onDisk.has(entry.module))
    .map((entry) => entry.module);
}

/** A requirement id in this project's own FAMILY-NN shape (SEAM-02,
 * EXPORT-01, COV-02, ANNO-13, CUT-04). Deliberately a shape check, not a
 * membership check against a file: a requirement document is reorganised
 * every milestone, and a guard that went red on that would be re-pointed
 * rather than believed. */
const REQUIREMENT_ID_RE = /^[A-Z][A-Z0-9]*(?:-[0-9]+)+$/;

/** DIRECTION 3. Everything wrong with one entry's basis: an empty basis, a
 * cited consumer path that is not on disk, a malformed requirement id, or a
 * blank rationale. Paths are repository-root-relative by the entry
 * interface's own contract. */
function basisProblems(entry: ModuleClassificationEntry, root: string = ROOT): string[] {
  const problems: string[] = [];
  const { consumers, requirements, rationale } = entry.basis;
  if (consumers.length === 0 && requirements.length === 0) {
    problems.push(`${entry.module}: basis names neither a consumer nor a requirement id`);
  }
  if (rationale.trim() === "") {
    problems.push(`${entry.module}: basis has no rationale`);
  }
  for (const consumer of consumers) {
    if (!existsSync(join(root, consumer.path))) {
      problems.push(`${entry.module}: cited consumer path ${consumer.path} does not exist on disk`);
    }
    if (consumer.symbol.trim() === "") {
      problems.push(`${entry.module}: consumer ${consumer.path} cites no symbol`);
    }
  }
  for (const id of requirements) {
    if (!REQUIREMENT_ID_RE.test(id)) {
      problems.push(`${entry.module}: requirement id ${JSON.stringify(id)} is not FAMILY-NN shaped`);
    }
  }
  return problems;
}

/** The shapes that read as "this verdict follows from what the module is
 * CALLED" -- the one justification success criterion 2 forbids outright, and
 * the only mechanically checkable half of it. Phrase-based on purpose: a
 * cited path or symbol legitimately contains the family's naming (every
 * consumer in the family does), so a bare substring test would reject every
 * honest citation in the record and be switched off within a milestone. */
const NAME_JUSTIFICATION_PATTERNS: readonly RegExp[] = [
  /\bprefix(es|ed)?\b/i,
  /because of its name\b/i,
  /\bnamed?\s+anno\b/i,
  /\bname\s+(alone|itself)\b/i,
  /\bnaming convention\b/i,
  /\banno-\*/,
];

/** DIRECTION 4. Every field of one entry's basis that justifies the verdict
 * by the module's name. Scans consumer paths, consumer symbols, requirement
 * ids and the rationale. Does NOT scan `note` -- see this file's header for
 * why that exemption is load-bearing rather than a loophole. */
function nameJustificationProblems(entry: ModuleClassificationEntry): string[] {
  const fields: { where: string; text: string }[] = [
    { where: "rationale", text: entry.basis.rationale },
    ...entry.basis.consumers.flatMap((consumer) => [
      { where: `consumers[].path (${consumer.path})`, text: consumer.path },
      { where: `consumers[].symbol (${consumer.symbol})`, text: consumer.symbol },
    ]),
    ...entry.basis.requirements.map((id) => ({ where: `requirements[] (${id})`, text: id })),
  ];
  const problems: string[] = [];
  for (const field of fields) {
    for (const pattern of NAME_JUSTIFICATION_PATTERNS) {
      if (pattern.test(field.text)) {
        problems.push(`${entry.module}: basis.${field.where} justifies the verdict by the module's name (matched ${pattern})`);
      }
    }
  }
  return problems;
}

/** DIRECTION 5. `extractables` must be non-empty IF AND ONLY IF the verdict
 * is the third one. Both directions, because either half alone lets a
 * verdict and its named obligations drift apart. */
function verdictExtractablesProblems(entry: ModuleClassificationEntry): string[] {
  const isThird = entry.verdict === "glue-with-extractable";
  const hasExtractables = entry.extractables.length > 0;
  if (isThird && !hasExtractables) {
    return [`${entry.module}: verdict is glue-with-extractable but names no extractable symbol`];
  }
  if (!isThird && hasExtractables) {
    return [`${entry.module}: verdict is ${entry.verdict} but names extractable symbols`];
  }
  return [];
}

/** DIRECTION 7 (adjacency). Every module named by more than one entry. */
function duplicateModules(entries: readonly ModuleClassificationEntry[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.module)) duplicates.add(entry.module);
    seen.add(entry.module);
  }
  return [...duplicates].sort();
}

/** DIRECTION 9. For every consumer carrying an advisory line, assert that
 * line of that file CONTAINS the cited symbol -- never trust the number.
 * The liability is measured, not hypothetical: three citations had drifted
 * by the time the registry was populated, all because earlier work in the
 * same phase inserted lines above them. Same shape as
 * `docs-linerefs.test.ts`'s containment check. */
function lineCitationProblems(entry: ModuleClassificationEntry, root: string = ROOT): string[] {
  const problems: string[] = [];
  for (const consumer of entry.basis.consumers) {
    if (consumer.line === undefined) continue;
    const abs = join(root, consumer.path);
    if (!existsSync(abs)) continue; // reported by basisProblems() instead
    const lines = readFileSync(abs, "utf8").split("\n");
    const text = lines[consumer.line - 1];
    if (text === undefined) {
      problems.push(`${entry.module}: cites ${consumer.path}:${consumer.line}, but that file has no such line`);
      continue;
    }
    if (!text.includes(consumer.symbol)) {
      problems.push(
        `${entry.module}: cites ${consumer.path}:${consumer.line} for ${consumer.symbol}, but that line does not contain it -- ` +
          `drift. Line reads: ${JSON.stringify(text)}`,
      );
    }
  }
  return problems;
}

/** Every `path:NN` citation in module-classification.ts's OWN source text --
 * its header prose and its `rationale`/`note` strings -- as
 * `{ path, line, symbol }`. Direction 9 above verifies only the citations the
 * record carries as STRUCTURED data (`basis.consumers[].line`); the module
 * additionally cites a dozen locations in prose, and those were outside every
 * gate in the tree while the module's own header called the drift liability
 * "MEASURED, NOT HYPOTHETICAL" and recorded that three citations had already
 * drifted while it was being written (WR-06).
 *
 * A bare `:NN` continuation (the `at anno-cli.ts:91 and :631` shape) inherits
 * the last path seen, which is how that shape reads to a human and how it
 * drifts.
 *
 * `symbol` is the nearest backticked identifier or `identifier()` token
 * EARLIER ON THE SAME SOURCE LINE, or undefined. Deliberately same-line only:
 * a wider window reaches back into the previous bullet and attributes that
 * bullet's symbol to this citation, which reddens a CORRECT record -- measured
 * while writing this, on the `anno-session.ts:294` citation, whose prose names
 * no symbol at all ("the single-flight session queue ... onward"). Under-
 * reaching costs coverage on a few citations; over-reaching costs trust in the
 * guard, and a guard that cries wolf gets deleted. */
function prosePathCitations(source: string): { path: string; line: number; symbol?: string }[] {
  const CITATION_RE = /([A-Za-z0-9_./-]+\.(?:ts|mts|md)):(\d+)|`:(\d+)`|\s:(\d+)\b/g;
  const SYMBOL_RE = /`([A-Za-z_$][A-Za-z0-9_$]*)(?:\(\))?`|\b([A-Za-z_$][A-Za-z0-9_$]{3,})\(\)/g;
  const citations: { path: string; line: number; symbol?: string }[] = [];
  let lastPath: string | undefined;
  for (const match of source.matchAll(CITATION_RE)) {
    let path: string | undefined;
    let line: number;
    if (match[1] !== undefined) {
      path = match[1];
      line = Number(match[2]);
      lastPath = path;
    } else {
      path = lastPath;
      line = Number(match[3] ?? match[4]);
    }
    if (path === undefined) continue; // a bare `:NN` before any path -- not a citation
    const index = match.index ?? 0;
    const sameLineBefore = source.slice(source.lastIndexOf("\n", index) + 1, index);
    const tokens = [...sameLineBefore.matchAll(SYMBOL_RE)];
    const last = tokens[tokens.length - 1];
    const symbol = last === undefined ? undefined : (last[1] ?? last[2]);
    citations.push(symbol === undefined ? { path, line } : { path, line, symbol });
  }
  return citations;
}

/** Resolves a citation path the way a reader would: a path containing `/` is
 * repo-relative, a bare module name is a sibling of this directory. */
function resolveCitationPath(path: string, root: string, here: string): string {
  return path.includes("/") ? join(root, path) : join(here, path);
}

// --- DIRECTION 6: the derived non-vacuity relation, placed FIRST so no loop
// --- below it can pass vacuously.

test("DIRECTION 6 (non-vacuity): the on-disk in-scope count is at least the number of in-enumeration entries, DERIVED from the registry rather than pinned", () => {
  const disk = inEnumerationOnDisk();
  const entries = inEnumerationEntries(MODULE_CLASSIFICATION);
  // WHY A DERIVED RELATION AND NOT A LITERAL FLOOR. The obvious in-repo
  // analog is `hostpath-consumers.test.ts`'s `ANNO_MODULE_FLOOR = 14`,
  // whose own comment says the number must be RAISED, never lowered. That
  // pattern is right about relations-over-equality and this assertion
  // supersedes it for one specific reason: a growing literal floor goes RED
  // on a correct tree the moment a later phase legitimately DELETES a module
  // together with its entry, and this project already carries the scar of a
  // guard that pinned per-milestone totals and reddened on correct trees. A
  // threshold taken from the registry itself catches the failure a literal
  // catches (a broken or empty glob, which would make Direction 1 vacuously
  // true) and survives legitimate change in BOTH directions. Do not
  // "restore" a literal here.
  assert.ok(
    disk.length >= entries.length,
    `the in-scope enumeration found ${disk.length} paths on disk but the registry declares ${entries.length} ` +
      "in-enumeration entries -- a glob returning fewer paths than there are entries means the enumeration is " +
      "broken or narrowed, and every completeness assertion below would pass vacuously",
  );
  // WHAT USED TO BE HERE, AND WHY IT IS GONE (plan 29-05, planner-found guard
  // N-10). This line read `assert.ok(disk.length > 0, "the in-scope
  // enumeration is empty -- the filter or the directory resolution is
  // broken")`. That is a correct guard against a broken glob and a WRONG one
  // against a scope that is legitimately emptying: this phase takes the
  // enumeration to zero ON PURPOSE, so the assertion would have gone red on a
  // correct tree at the deletion, two waves from here, and the cheapest fix
  // under that pressure is to delete it -- taking the broken-glob protection
  // with it. Its fate is decided HERE instead, before the pressure exists.
  //
  // The broken-glob half is NOT lost: `disk.length >= entries.length` above
  // still catches a filter that narrowed or a directory that resolved wrong,
  // because a glob returning fewer paths than there are in-enumeration
  // entries fails it. What replaces the `> 0` half is the DISCHARGE-CLOSURE
  // relation below -- non-vacuity that stays checkable precisely BECAUSE the
  // enumeration empties, since every path that leaves it must leave a fate
  // behind that resolves.
});

test("DISCHARGE CLOSURE (plan 29-05): every discharged entry's fate resolves against disk -- a rename to a file that is there, or a deletion of a file that is not", () => {
  const discharged = dischargedEntries(MODULE_CLASSIFICATION);
  // Non-vacuity, so the relation cannot pass over an empty set the way the
  // assertion it replaces could once the enumeration emptied.
  assert.ok(
    discharged.length > 0,
    "no entry carries the discharged scope -- this relation would then pass over an empty set, which is exactly " +
      "the vacuous-guard shape it was introduced to avoid becoming",
  );
  const problems = discharged.flatMap((entry) => dischargeClosureProblems(entry));
  assert.deepEqual(
    problems,
    [],
    `discharge-closure problems:\n  ${problems.join("\n  ")}\n\nA fate naming a path that is not there is how a ` +
      "rename gets RECORDED without HAPPENING -- the record would then say the capability survived while the tree " +
      "said it did not, which is the exact failure this registry exists to prevent, one level up.",
  );
});

test("planted violation (discharge closure): a fate naming a nonexistent file, a self-rename, a missing fate and a survived deletion are all reported by the same predicate the real scan calls", () => {
  const base: ModuleClassificationEntry = {
    module: "anno-synthetic-discharged.ts",
    scope: "discharged",
    verdict: "capability",
    basis: {
      consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION" }],
      requirements: ["SEAM-02"],
      rationale: "a synthetic discharged entry, used only to drive the closure predicate",
    },
    extractables: [],
  };

  const renamedToNothing: ModuleClassificationEntry = {
    ...base,
    fate: { kind: "renamed", from: "anno-synthetic-discharged.ts", to: "anno-this-file-does-not-exist.ts", on: "2026-08-29", why: "x" },
  };
  assert.ok(
    dischargeClosureProblems(renamedToNothing).some((problem) => problem.includes("is NOT on disk")),
    "a rename recorded to a file that is not there must be reported -- otherwise the relation cannot catch a " +
      "rename that was written down and never carried out",
  );

  const selfRename: ModuleClassificationEntry = {
    ...base,
    module: "module-classification.ts",
    fate: { kind: "renamed", from: "module-classification.ts", to: "module-classification.ts", on: "2026-08-29", why: "x" },
  };
  assert.ok(
    dischargeClosureProblems(selfRename).some((problem) => problem.includes("moved nothing")),
    "a fate whose from and to are the same name must be reported -- it records a move that did not happen",
  );

  const noFate: ModuleClassificationEntry = { ...base };
  assert.ok(
    dischargeClosureProblems(noFate).some((problem) => problem.includes("records no fate")),
    "a discharged entry with no fate must be reported -- the scope claims something happened and nothing says what",
  );

  const survivedDeletion: ModuleClassificationEntry = {
    ...base,
    module: "module-classification.ts",
    fate: { kind: "deleted", on: "2026-08-29", why: "x" },
  };
  assert.ok(
    dischargeClosureProblems(survivedDeletion).some((problem) => problem.includes("still on disk")),
    "a deletion recorded against a file that is still there must be reported",
  );

  // The non-vacuity half: a REAL discharged entry from the registry is
  // reported by none of them, so the predicate is not simply rejecting
  // everything.
  const real = dischargedEntries(MODULE_CLASSIFICATION)[0];
  assert.ok(real !== undefined, "expected the registry to carry at least one real discharged entry");
  assert.deepEqual(dischargeClosureProblems(real), [], `a correct discharged entry (${real.module}) must not be reported`);
});

// --- DIRECTION 1 and 2: the two completeness directions.

test("DIRECTION 1 (completeness): every in-scope module and data file on disk has a registry entry, and the failure names it", () => {
  const unclassified = unclassifiedModules(MODULE_CLASSIFICATION, inEnumerationOnDisk());
  assert.ok(
    unclassified.length === 0,
    `these in-scope files have no capability-or-glue verdict: ${unclassified.join(", ")} -- a module added ` +
      "without an entry must fail HERE, before a later phase deletes it by name with no record to check",
  );
});

test("DIRECTION 2 (no orphans): every in-enumeration entry names a module that exists on disk", () => {
  const orphans = orphanedEntries(MODULE_CLASSIFICATION, inEnumerationOnDisk());
  assert.ok(
    orphans.length === 0,
    `these registry entries name a module that is not on disk: ${orphans.join(", ")} -- an entry left behind ` +
      "after a rename or a deletion is a record that has silently stopped matching the tree",
  );
});

test("DIRECTION 2 (encoding): the generated data file is matched by its FULL filename including the extension, never by a stem", () => {
  // RE-EXPRESSED BY PLAN 29-05, and the reason is the whole point of the
  // `discharged` scope. This assertion used to read the data file out of
  // `inEnumerationOnDisk()`. The rename took it OUT of that enumeration -- the
  // enumeration is the anno-prefixed family awaiting deletion, and the data
  // file is a survivor now -- so reading it from there would either go red on
  // a correct tree or force the enumeration to be widened to keep one
  // assertion alive, which is a guard re-pointed at a subject that cannot
  // fail. The CHECKED PROPERTY is unchanged and is the only thing that
  // mattered: the registry keys on the EXACT filename INCLUDING the
  // extension, never on a stem.
  const entry = classificationFor("anno-regbits.json");
  assert.ok(entry !== undefined, "the data file must have its own entry, keyed by its full filename");
  assert.equal(entry?.scope, "discharged", "and that entry records a carried-out fate rather than an enumeration membership");
  assert.ok(existsSync(join(HERE, "anno-regbits.json")), "the generated data file itself must still be on disk under the name its fate names");
  assert.ok(
    classificationFor("anno-regbits") === undefined,
    "a stem must NOT resolve to the data file's entry -- module values and on-disk filenames are compared as exact strings",
  );
  assert.ok(
    classificationFor("retired-analyser-regbits.json") === undefined,
    "and the PRE-RENAME full filename must not resolve either -- the entry moved with the file, it was not duplicated",
  );
});

// --- DIRECTION 3, 4, 5, 7: per-entry integrity.

test("DIRECTION 3 (basis integrity): every entry's basis is non-empty, every cited consumer path exists on disk, and every requirement id is well-shaped", () => {
  const problems = MODULE_CLASSIFICATION.flatMap((entry) => basisProblems(entry));
  assert.ok(problems.length === 0, `basis problems:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 4 (the name prohibition): no entry's basis justifies its verdict by the module's name", () => {
  const problems = MODULE_CLASSIFICATION.flatMap((entry) => nameJustificationProblems(entry));
  assert.ok(problems.length === 0, `name-as-justification problems:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 5 (verdict coherence): extractables is non-empty if and only if the verdict is glue-with-extractable", () => {
  const problems = MODULE_CLASSIFICATION.flatMap((entry) => verdictExtractablesProblems(entry));
  assert.ok(problems.length === 0, `verdict/extractables problems:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 7 (adjacency): no two entries name the same module", () => {
  const duplicates = duplicateModules(MODULE_CLASSIFICATION);
  assert.ok(duplicates.length === 0, `modules named by more than one entry: ${duplicates.join(", ")}`);
});

test("DIRECTION 7 (adjacency): out-of-enumeration AND discharged entries are excluded from the completeness loop rather than colliding with it", () => {
  const outOfScope = MODULE_CLASSIFICATION.filter((entry) => entry.scope === "out-of-enumeration");
  assert.ok(outOfScope.length > 0, "the registry must carry the deliberately-excluded files as data, not drop them");
  const discharged = dischargedEntries(MODULE_CLASSIFICATION);
  assert.ok(discharged.length > 0, "the registry must carry carried-out fates as data, not drop them");
  const disk = inEnumerationOnDisk();
  for (const entry of [...outOfScope, ...discharged]) {
    assert.ok(
      !disk.includes(entry.module),
      `${entry.module} is marked ${entry.scope} but the enumeration found it -- the marker and the filter disagree`,
    );
  }
  // The proof that the marker does the excluding: removing every entry the
  // completeness loop is not meant to see changes neither direction. Extended
  // by plan 29-05 to cover "discharged" the same way, so the third scope value
  // is excluded BY ITS MARKER rather than by a special case inside the loop --
  // which is the property that made the second value trustworthy.
  const inScopeOnly = MODULE_CLASSIFICATION.filter((entry) => entry.scope === "in-enumeration");
  assert.deepEqual(unclassifiedModules(inScopeOnly, disk), unclassifiedModules(MODULE_CLASSIFICATION, disk));
  assert.deepEqual(orphanedEntries(inScopeOnly, disk), orphanedEntries(MODULE_CLASSIFICATION, disk));
});

// --- DIRECTION 9: advisory line citations.

test("DIRECTION 9 (precision): every advisory line citation is verified by containment -- the cited line contains the cited symbol", () => {
  const problems = MODULE_CLASSIFICATION.flatMap((entry) => lineCitationProblems(entry));
  assert.ok(problems.length === 0, `line citation drift:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 9 (non-vacuity): the record actually carries advisory line citations for this direction to check", () => {
  const cited = MODULE_CLASSIFICATION.flatMap((entry) => entry.basis.consumers).filter((consumer) => consumer.line !== undefined);
  assert.ok(
    cited.length > 0,
    "no consumer carries a line citation -- Direction 9 would then pass over an empty set, which is exactly the " +
      "vacuous-guard shape this suite refuses",
  );
});

test("DIRECTION 9b (prose citations): every `path:NN` cited in this module's OWN source resolves to a real file and a real, non-blank line", () => {
  const source = readFileSync(join(HERE, "module-classification.ts"), "utf8");
  const problems: string[] = [];
  for (const citation of prosePathCitations(source)) {
    const abs = resolveCitationPath(citation.path, ROOT, HERE);
    if (!existsSync(abs)) {
      problems.push(`cites ${citation.path}:${citation.line}, but that file does not exist`);
      continue;
    }
    const text = readFileSync(abs, "utf8").split("\n")[citation.line - 1];
    if (text === undefined) {
      problems.push(`cites ${citation.path}:${citation.line}, but that file has no such line`);
      continue;
    }
    if (text.trim() === "") {
      problems.push(`cites ${citation.path}:${citation.line}, but that line is blank -- the cited region moved`);
      continue;
    }
    // The containment half, where the prose names a symbol adjacent to the
    // citation. This is the same check Direction 9 applies to the structured
    // citations; see prosePathCitations() for why the window is same-line only.
    if (citation.symbol !== undefined && !text.includes(citation.symbol)) {
      problems.push(
        `cites ${citation.path}:${citation.line} for ${citation.symbol}, but that line does not contain it -- ` +
          `drift. Line reads: ${JSON.stringify(text)}`,
      );
    }
  }
  assert.deepEqual(problems, [], `prose line citation drift in module-classification.ts:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 9b (non-vacuity): the extractor actually finds prose citations, and some of them carry a symbol to contain", () => {
  // Without this, rewording the header so the citation regex matches nothing
  // would make the check above pass over an empty set -- the vacuous-guard
  // shape this suite refuses. Stated as relations, not as pinned counts, so
  // adding or removing a citation never reddens it (see Direction 6's
  // argument against literal floors).
  const citations = prosePathCitations(readFileSync(join(HERE, "module-classification.ts"), "utf8"));
  assert.ok(citations.length > 0, "the prose-citation extractor found nothing -- it has stopped seeing the citation shape");
  assert.ok(
    citations.some((citation) => citation.symbol !== undefined),
    "no prose citation carries an adjacent symbol -- the containment half of 9b would then be vacuous",
  );
});

// --- DIRECTION 8: order independence.

test("DIRECTION 8 (ordering): re-running Directions 1-5, 7 and 9 over a REVERSED copy of the registry yields identical results", () => {
  const disk = inEnumerationOnDisk();
  const reversed = [...MODULE_CLASSIFICATION].reverse();

  assert.deepEqual(unclassifiedModules(reversed, disk).sort(), unclassifiedModules(MODULE_CLASSIFICATION, disk).sort());
  assert.deepEqual(orphanedEntries(reversed, disk).sort(), orphanedEntries(MODULE_CLASSIFICATION, disk).sort());
  assert.deepEqual(duplicateModules(reversed), duplicateModules(MODULE_CLASSIFICATION));
  assert.deepEqual(
    reversed.flatMap((entry) => basisProblems(entry)).sort(),
    MODULE_CLASSIFICATION.flatMap((entry) => basisProblems(entry)).sort(),
  );
  assert.deepEqual(
    reversed.flatMap((entry) => nameJustificationProblems(entry)).sort(),
    MODULE_CLASSIFICATION.flatMap((entry) => nameJustificationProblems(entry)).sort(),
  );
  assert.deepEqual(
    reversed.flatMap((entry) => verdictExtractablesProblems(entry)).sort(),
    MODULE_CLASSIFICATION.flatMap((entry) => verdictExtractablesProblems(entry)).sort(),
  );
  assert.deepEqual(
    reversed.flatMap((entry) => lineCitationProblems(entry)).sort(),
    MODULE_CLASSIFICATION.flatMap((entry) => lineCitationProblems(entry)).sort(),
  );

  // And the accessor answers by KEY, not by position: it must return the
  // same entry against a reversed array's contents.
  for (const entry of reversed) {
    assert.equal(classificationFor(entry.module), entry, `${entry.module} must resolve by module key regardless of array order`);
  }
});

// --- The planted violations: the SAME predicates the real scan calls.

test("planted violation: the same predicates the real scan uses report all five synthetic bad entries, and do not report the clean one", () => {
  const cleanConsumerPath = "src/mcp/vice/module-classification.ts";

  const emptyBasis: ModuleClassificationEntry = {
    module: "anno-synthetic-empty.ts",
    scope: "in-enumeration",
    verdict: "capability",
    basis: { consumers: [], requirements: [], rationale: "" },
    extractables: [],
  };
  const missingPath: ModuleClassificationEntry = {
    module: "anno-synthetic-missing-path.ts",
    scope: "in-enumeration",
    verdict: "capability",
    basis: {
      consumers: [{ path: "src/mcp/vice/anno-this-file-does-not-exist.ts", symbol: "somethingReal" }],
      requirements: ["SEAM-02"],
      rationale: "cites a consumer that is not on disk",
    },
    extractables: [],
  };
  const nameJustified: ModuleClassificationEntry = {
    module: "anno-synthetic-name-justified.ts",
    scope: "in-enumeration",
    verdict: "capability",
    basis: {
      consumers: [{ path: cleanConsumerPath, symbol: "MODULE_CLASSIFICATION" }],
      requirements: ["SEAM-02"],
      rationale: "Kept because of its name prefix, which is the one justification criterion 2 forbids.",
    },
    extractables: [],
  };
  const thirdVerdictNoExtractables: ModuleClassificationEntry = {
    module: "anno-synthetic-third-verdict.ts",
    scope: "in-enumeration",
    verdict: "glue-with-extractable",
    basis: {
      consumers: [{ path: cleanConsumerPath, symbol: "MODULE_CLASSIFICATION" }],
      requirements: ["SEAM-02"],
      rationale: "declares the third verdict but names no symbol that must move out",
    },
    extractables: [],
  };
  const clean: ModuleClassificationEntry = {
    module: "anno-synthetic-clean.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [{ path: cleanConsumerPath, symbol: "MODULE_CLASSIFICATION" }],
      requirements: ["SEAM-02"],
      rationale: "speaks the rented analyser's own protocol and nothing else",
    },
    extractables: [],
  };

  // (a) empty basis
  assert.ok(
    basisProblems(emptyBasis).length >= 2,
    "an entry with no consumer, no requirement id and no rationale must be reported by basisProblems() -- if it is " +
      "not, the real scan above cannot catch a real empty basis",
  );
  // (b) nonexistent consumer path
  assert.ok(
    basisProblems(missingPath).some((problem) => problem.includes("does not exist on disk")),
    "a cited consumer path that is not on disk must be reported by the same predicate the real scan calls",
  );
  // (c) the name as the justification
  assert.ok(
    nameJustificationProblems(nameJustified).length > 0,
    "a basis whose rationale justifies the verdict by the module's name must be reported -- this is the only " +
      "mechanically checkable half of criterion 2",
  );
  // (d) duplicate module
  assert.deepEqual(duplicateModules([clean, thirdVerdictNoExtractables, clean]), ["anno-synthetic-clean.ts"]);
  // (e) third verdict with no extractables
  assert.ok(
    verdictExtractablesProblems(thirdVerdictNoExtractables).length > 0,
    "the third verdict with an empty extractables list must be reported by verdictExtractablesProblems()",
  );

  // The non-vacuity half: the clean entry is reported by NONE of them.
  assert.ok(basisProblems(clean).length === 0, "the clean synthetic entry must not be reported by basisProblems()");
  assert.ok(nameJustificationProblems(clean).length === 0, "the clean synthetic entry must not be reported by nameJustificationProblems()");
  assert.ok(verdictExtractablesProblems(clean).length === 0, "the clean synthetic entry must not be reported by verdictExtractablesProblems()");
  assert.ok(lineCitationProblems(clean).length === 0, "the clean synthetic entry carries no line citation and must not be reported");
  assert.ok(duplicateModules([clean, thirdVerdictNoExtractables]).length === 0, "two distinct modules must not be reported as duplicates");
});

test("planted violation: an in-scope file with no entry is reported by the same completeness predicate the real scan calls", () => {
  // The synthetic disk list is FULLY synthetic -- two names the entry list
  // does classify plus one it does not -- rather than the real enumeration
  // with one name appended. Measured: appending to the real enumeration made
  // THIS test go red alongside Direction 1 during plan 29-05's own on-disk
  // break-and-restore probe, because the planted file then appeared in the
  // list too, and that muddied the attribution of an observed RED. A
  // predicate test should exercise the predicate, not the filesystem.
  //
  // THE ENTRY LIST IS NOW SYNTHETIC TOO (plan 29-10), for exactly the same
  // reason one step further out. This test used to pass the REAL registry and
  // name two of its then-`in-enumeration` modules. Plan 29-10 deleted every
  // one of those, so the real registry's in-enumeration set is now EMPTY by
  // design -- and against an empty set the two "classified" names read as
  // unclassified and this test went red without anything being wrong. A
  // predicate test should exercise the predicate, not the registry's current
  // contents either; the registry's own completeness is Direction 1's job.
  const syntheticEntries: readonly ModuleClassificationEntry[] = [
    {
      module: "anno-synthetic-classified-a.ts",
      scope: "in-enumeration",
      verdict: "glue",
      basis: { consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION" }], requirements: [], rationale: "x" },
      extractables: [],
    },
    {
      module: "anno-synthetic-classified-b.ts",
      scope: "in-enumeration",
      verdict: "glue",
      basis: { consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION" }], requirements: [], rationale: "x" },
      extractables: [],
    },
  ];
  const syntheticDisk = [
    "anno-synthetic-classified-a.ts",
    "anno-synthetic-classified-b.ts",
    "anno-synthetic-unclassified.ts",
  ];
  const unclassified = unclassifiedModules(syntheticEntries, syntheticDisk);
  assert.deepEqual(
    unclassified,
    ["anno-synthetic-unclassified.ts"],
    "a file present in the enumeration with no registry entry must be reported BY NAME -- if it is not, Direction 1 " +
      "cannot catch a module that slips in unclassified",
  );
  // And an entry with no file on disk is reported by the other direction.
  const orphanEntry: ModuleClassificationEntry = {
    module: "anno-renamed-away.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: { consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION" }], requirements: [], rationale: "x" },
    extractables: [],
  };
  assert.deepEqual(orphanedEntries([...MODULE_CLASSIFICATION, orphanEntry], inEnumerationOnDisk()), ["anno-renamed-away.ts"]);
});

test("planted violation: a drifted advisory line citation is reported by lineCitationProblems(), and a correct one is not", () => {
  // Line 1 of the registry is its own header comment, which never contains
  // the exported const's name -- so a citation planted there must be
  // rejected by the same containment check the real scan uses.
  const drifted: ModuleClassificationEntry = {
    module: "anno-synthetic-drift.ts",
    scope: "in-enumeration",
    verdict: "glue",
    basis: {
      consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION", line: 1 }],
      requirements: [],
      rationale: "cites a line that does not contain the cited symbol",
    },
    extractables: [],
  };
  const problems = lineCitationProblems(drifted);
  assert.ok(problems.length > 0, "a citation pointing at a line that does not contain the symbol must be reported as drift");
  assert.ok(problems[0].includes("drift"), `the failure must name the drift; got: ${problems[0]}`);

  const registryLines = readFileSync(join(ROOT, "src/mcp/vice/module-classification.ts"), "utf8").split("\n");
  const realLine = registryLines.findIndex((text) => text.includes("export const MODULE_CLASSIFICATION")) + 1;
  assert.ok(realLine > 0, "expected to find the exported const's declaration line");
  const correct: ModuleClassificationEntry = {
    ...drifted,
    basis: { ...drifted.basis, consumers: [{ path: "src/mcp/vice/module-classification.ts", symbol: "MODULE_CLASSIFICATION", line: realLine }] },
  };
  assert.ok(lineCitationProblems(correct).length === 0, "a correct citation must not be reported -- otherwise the check rejects everything");
});

// --- Structural: this record is bookkeeping and must never ship.

test("module-classification.ts is absent from package.json's files[] array (bookkeeping, not shipped runtime behaviour)", () => {
  // Uses the extracted files[] enumerator rather than a local re-read, so
  // the shipped set is derived in exactly one place in this repo.
  assert.ok(
    !shippedTsModules().includes("module-classification.ts"),
    "module-classification.ts records a judgement about this repo's own modules and must never enter the published tarball",
  );
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.ok(!pkg.files.includes("module-classification.ts"), "and the same absence read directly from the manifest");
});
