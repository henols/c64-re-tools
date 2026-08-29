// anno-register.test.ts -- what turns `anno-register.ts` from a document into
// an OBLIGATION (MCP-01, D-08).
//
// WHY THIS FILE EXISTS. `anno-register.ts` records why each surface verb the
// Phase 19 upstream procedure manifest does not classify exists. A prose record
// would do the same job and then go stale with nothing failing. This file
// enumerates the surface, subtracts the manifest-classified names, and FAILS --
// naming the offending verb -- the moment a verb has no entry, an entry names no
// verb, an entry cites nothing, or an entry silently shadows the manifest.
// D-08's wording is literal and is the wording the failure uses: a verb added
// later with no named consumer FAILS rather than being reviewed.
//
// SIX NAMED DIRECTIONS, each extracted into a NAMED PREDICATE that the real scan
// and the planted-violation tests both call. That sharing is the property that
// makes the guard trustworthy, and it is the established shape in this suite
// (`module-classification.test.ts:11-14` states the rule; `hostpath-consumers.test.ts`
// follows it): a planted violation that re-implements the rule proves nothing
// about the rule the real scan applies.
//
//   1. non-vacuity   -- a DERIVED relation, never a pinned total, placed FIRST
//                       so nothing below it can pass over an empty set
//   2. completeness  -- every unclassified surface verb has an entry
//   3. no orphans    -- every entry names a verb that is on the surface
//   4. collision     -- an "unclassified" entry whose verb the manifest DOES
//                       classify is reported by name, and so is the mis-kind in
//                       the other direction
//   5. basis         -- at least one consumer AND at least one requirement id,
//                       every cited path on disk, every id well-shaped and
//                       present in the requirements document
//   6. ordering      -- identical results over reversed copies of BOTH the
//                       register and the definition table
//
// DIRECTION 1 IS THE ONE TO GET RIGHT. Its threshold is DERIVED from the surface
// and the register, never written as a literal, for the reason
// `module-classification.test.ts` records at its own Direction 6: a growing
// literal goes red on a correct tree the moment a verb is legitimately retired
// together with its entry, and this repository already carries the scar of
// guards that pinned totals and reddened on correct trees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ANNO_VERB_REGISTER, annoRegisterEntryFor } from "./anno-register.ts";
import type { AnnoVerbRegisterEntry } from "./anno-register.ts";
import { ANNO_TOOL_DEFINITIONS, CURATED_ANNO_TOOLS } from "./anno-tools.ts";
import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

const MANIFEST_PATH = resolve(
  HERE,
  "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json",
);
const REQUIREMENTS_PATH = resolve(HERE, "../../../.planning/REQUIREMENTS.md");

/** The surface, as names. Taken from the definition table rather than from
 * `CURATED_ANNO_TOOLS` in the scan below, so the ordering direction can drive
 * the same code path against a reversed copy of the table. */
function surfaceNames(definitions: readonly { name: string }[] = ANNO_TOOL_DEFINITIONS): string[] {
  return definitions.map((definition) => definition.name);
}

/**
 * A verb name with its family prefix removed -- everything after the FIRST
 * underscore. Deliberately prefix-agnostic: it takes an upstream name and a
 * surface name to the same string without either prefix literal appearing here,
 * so this relation survives both the family rename this milestone performed and
 * any future one.
 */
function verbSuffix(name: string): string {
  const underscore = name.indexOf("_");
  return underscore === -1 ? name : name.slice(underscore + 1);
}

/**
 * Every verb suffix the manifest's five procedures mention, under any
 * disposition.
 *
 * THIS IS NOT A SECOND COPY OF THE DERIVATION CHECK'S NAME MAPPING, and the
 * difference is deliberate. `anno-derivation.test.ts` owns the one EXACT
 * upstream-to-surface mapping, with its two documented departures; that mapping
 * answers "which surface name does this upstream verb become?". This answers a
 * different and deliberately BROADER question -- "does the manifest mention a
 * verb corresponding to this name at all, under any spelling?" -- which is the
 * right shape for a shadowing check, because a relation NARROWER than the real
 * mapping could let a shadow through, whereas a broader one can only raise a
 * false alarm that names the verb and is resolved by re-kinding its entry.
 */
function manifestVerbSuffixes(manifestPath: string = MANIFEST_PATH): Set<string> {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const suffixes = new Set<string>();
  for (const procedure of manifest.procedures) {
    for (const upstream of Object.keys(procedure.tools)) suffixes.add(verbSuffix(upstream));
  }
  return suffixes;
}

/** The surface verbs the manifest does not classify -- the population the
 * register exists to cover. Derived by subtraction, never listed. */
function unclassifiedSurfaceVerbs(
  names: readonly string[],
  manifestSuffixes: ReadonlySet<string>,
): string[] {
  return names.filter((name) => !manifestSuffixes.has(verbSuffix(name)));
}

/** The register's two populations, kept apart because they answer different
 * questions and are checked by different directions. */
function entriesOfKind(
  entries: readonly AnnoVerbRegisterEntry[],
  kind: AnnoVerbRegisterEntry["kind"],
): AnnoVerbRegisterEntry[] {
  return entries.filter((entry) => entry.kind === kind);
}

/** DIRECTION 2 (completeness). Every unclassified surface verb with no register
 * entry, returned so the failure can NAME it. This is the predicate D-08's
 * sentence is about. */
function unregisteredVerbs(
  entries: readonly AnnoVerbRegisterEntry[],
  names: readonly string[],
  manifestSuffixes: ReadonlySet<string>,
): string[] {
  const registered = new Set(entries.map((entry) => entry.verb));
  return unclassifiedSurfaceVerbs(names, manifestSuffixes).filter((verb) => !registered.has(verb));
}

/** DIRECTION 3 (no orphans). Every entry naming a verb that is not on the
 * surface -- the leftover an entry becomes after a verb is renamed or retired. */
function orphanedEntries(
  entries: readonly AnnoVerbRegisterEntry[],
  names: readonly string[],
): string[] {
  const onSurface = new Set(names);
  return entries.filter((entry) => !onSurface.has(entry.verb)).map((entry) => entry.verb);
}

/**
 * DIRECTION 4 (collision), both directions.
 *
 *   - an "unclassified" entry whose verb the manifest DOES classify: the
 *     register would then silently shadow the manifest, which is exactly the
 *     rubber stamp D-08 forbids;
 *   - a "manifest-deviation" entry whose verb the manifest does NOT classify:
 *     the entry claims a deviation from a contract that does not exist, so the
 *     two kinds have drifted apart and a reader can no longer tell them apart.
 */
function collisionProblems(
  entry: AnnoVerbRegisterEntry,
  manifestSuffixes: ReadonlySet<string>,
): string[] {
  const classified = manifestSuffixes.has(verbSuffix(entry.verb));
  if (entry.kind === "unclassified" && classified) {
    return [
      `${entry.verb}: registered as "unclassified" but the Phase 19 manifest DOES classify a verb of that ` +
        "name -- the register would shadow the manifest, which makes the derivation decorative. Either " +
        'the entry is unnecessary, or it is a deviation and must be kinded "manifest-deviation".',
    ];
  }
  if (entry.kind === "manifest-deviation" && !classified) {
    return [
      `${entry.verb}: registered as "manifest-deviation" but the Phase 19 manifest classifies no verb of ` +
        'that name -- a deviation from a contract that does not exist. It is an "unclassified" verb.',
    ];
  }
  return [];
}

/** A requirement id in this project's own FAMILY-NN shape. */
const REQUIREMENT_ID_RE = /^[A-Z][A-Z0-9]*(?:-[0-9]+)+$/;

/** Every requirement id the requirements document declares, read from its own
 * bolded declarations. Membership is checked as well as shape here -- unlike
 * `module-classification.test.ts`, which checks shape only -- because this
 * register's whole basis rests on the id being real: an entry citing a
 * plausible-looking id that no requirement document declares is precisely the
 * rubber stamp D-08's prohibition names. */
function declaredRequirementIds(path: string = REQUIREMENTS_PATH): Set<string> {
  const source = readFileSync(path, "utf8");
  const ids = new Set<string>();
  for (const match of source.matchAll(/\*\*([A-Z][A-Z0-9]*(?:-[0-9]+)+)\*\*/g)) ids.add(match[1]);
  return ids;
}

/**
 * DIRECTION 5 (basis integrity). Everything wrong with one entry's basis.
 *
 * BOTH a consumer AND a requirement id are required, which is stricter than the
 * "one or the other" rule `module-classification.ts` could afford. Its subject
 * was a module that already existed and could be read; this register's subject
 * is a PUBLIC SURFACE COMMITMENT, and D-08 asks for a cited requirement id and a
 * named consumer, not for whichever was easier to produce.
 */
function basisProblems(
  entry: AnnoVerbRegisterEntry,
  root: string = ROOT,
  declaredIds: ReadonlySet<string> = declaredRequirementIds(),
): string[] {
  const problems: string[] = [];
  if (entry.requirements.length === 0) {
    problems.push(`${entry.verb}: cites no requirement id -- an entry citing no requirement id is not an entry`);
  }
  if (entry.consumers.length === 0) {
    problems.push(`${entry.verb}: names no consumer -- a verb with no named consumer FAILS rather than being reviewed`);
  }
  if (entry.rationale.trim() === "") {
    problems.push(`${entry.verb}: has no rationale`);
  }
  for (const consumer of entry.consumers) {
    if (!existsSync(join(root, consumer.path))) {
      problems.push(`${entry.verb}: cited consumer path ${consumer.path} does not exist on disk`);
    }
    if (consumer.symbol.trim() === "") {
      problems.push(`${entry.verb}: consumer ${consumer.path} cites no symbol`);
    }
  }
  for (const id of entry.requirements) {
    if (!REQUIREMENT_ID_RE.test(id)) {
      problems.push(`${entry.verb}: requirement id ${JSON.stringify(id)} is not FAMILY-NN shaped`);
      continue;
    }
    if (!declaredIds.has(id)) {
      problems.push(
        `${entry.verb}: requirement id ${id} is well-shaped but is NOT declared in .planning/REQUIREMENTS.md -- ` +
          "a plausible-looking id nothing declares is the rubber stamp this register exists to prevent",
      );
    }
  }
  return problems;
}

/** An advisory `line` citation, verified and never trusted -- the discipline the
 * register's own header states. */
function lineCitationProblems(entry: AnnoVerbRegisterEntry, root: string = ROOT): string[] {
  const problems: string[] = [];
  for (const consumer of entry.consumers) {
    if (consumer.line === undefined) continue;
    const abs = join(root, consumer.path);
    if (!existsSync(abs)) continue; // reported by basisProblems() instead
    const text = readFileSync(abs, "utf8").split("\n")[consumer.line - 1];
    if (text === undefined) {
      problems.push(`${entry.verb}: cites ${consumer.path}:${consumer.line}, but that file has no such line`);
      continue;
    }
    if (!text.includes(consumer.symbol)) {
      problems.push(
        `${entry.verb}: cites ${consumer.path}:${consumer.line} for ${consumer.symbol}, but that line does not ` +
          `contain it -- drift. Line reads: ${JSON.stringify(text)}`,
      );
    }
  }
  return problems;
}

/** Every direction's verdict as one comparable value, so the ordering direction
 * compares RESULTS rather than re-listing assertions. */
function scanVerdict(
  entries: readonly AnnoVerbRegisterEntry[],
  definitions: readonly { name: string }[],
  manifestSuffixes: ReadonlySet<string>,
): {
  unregistered: string[];
  orphans: string[];
  collisions: string[];
  basis: string[];
  lines: string[];
  unclassified: string[];
} {
  const names = surfaceNames(definitions);
  const declaredIds = declaredRequirementIds();
  return {
    unregistered: unregisteredVerbs(entries, names, manifestSuffixes).sort(),
    orphans: orphanedEntries(entries, names).sort(),
    collisions: entries.flatMap((entry) => collisionProblems(entry, manifestSuffixes)).sort(),
    basis: entries.flatMap((entry) => basisProblems(entry, ROOT, declaredIds)).sort(),
    lines: entries.flatMap((entry) => lineCitationProblems(entry)).sort(),
    unclassified: unclassifiedSurfaceVerbs(names, manifestSuffixes).sort(),
  };
}

// --- DIRECTION 1: the derived non-vacuity relation, placed FIRST so no loop
// --- below it can pass over an empty set.

test("DIRECTION 1 (non-vacuity): the unclassified surface population is at least the number of unclassified register entries, and neither is empty -- DERIVED, never pinned", () => {
  const unclassifiedVerbs = unclassifiedSurfaceVerbs(surfaceNames(), manifestVerbSuffixes());
  const unclassifiedEntries = entriesOfKind(ANNO_VERB_REGISTER, "unclassified");
  assert.ok(
    unclassifiedVerbs.length > 0,
    "the surface minus the manifest-classified names is EMPTY -- either the manifest read returned nothing " +
      "and every suffix matched vacuously, or the surface is empty. Every direction below would then pass by " +
      "finding nothing to check.",
  );
  assert.ok(
    ANNO_VERB_REGISTER.length > 0,
    "the register enumerates nothing -- completeness, orphans, collision and basis would all pass trivially",
  );
  assert.ok(
    unclassifiedVerbs.length >= unclassifiedEntries.length,
    `the surface carries ${unclassifiedVerbs.length} unclassified verbs but the register declares ` +
      `${unclassifiedEntries.length} unclassified entries -- more entries than there are verbs means the ` +
      "subtraction is broken or the register has grown past the surface it describes",
  );
});

test("DIRECTION 2 (completeness): every surface verb the manifest does not classify has a register entry -- a verb with no named consumer FAILS rather than being reviewed (D-08)", () => {
  const unregistered = unregisteredVerbs(ANNO_VERB_REGISTER, surfaceNames(), manifestVerbSuffixes());
  assert.deepEqual(
    unregistered,
    [],
    `these surface verbs are classified by NEITHER the Phase 19 manifest NOR the committed register: ` +
      `${unregistered.join(", ")}. D-08 is literal about what happens next: a verb added with no named consumer ` +
      "FAILS rather than being reviewed. Add an entry to anno-register.ts citing at least one requirement id and " +
      "at least one consumer, or take the verb off the surface.",
  );
});

test("DIRECTION 3 (no orphans): every register entry names a verb that is actually on the surface", () => {
  const orphans = orphanedEntries(ANNO_VERB_REGISTER, surfaceNames());
  assert.deepEqual(
    orphans,
    [],
    `these register entries name verbs that are not on the surface: ${orphans.join(", ")}. An entry for a verb ` +
      "that no longer exists is the leftover a rename or a retirement produces, and it makes the register's own " +
      "count untrustworthy.",
  );
});

test("DIRECTION 4 (collision): a verb classified by BOTH the manifest and the register is reported by name, and so is the mis-kind in the other direction", () => {
  const manifestSuffixes = manifestVerbSuffixes();
  const problems = ANNO_VERB_REGISTER.flatMap((entry) => collisionProblems(entry, manifestSuffixes));
  assert.deepEqual(
    problems,
    [],
    `collision problems:\n  ${problems.join("\n  ")}\n\nThe register must never silently shadow the manifest: ` +
      "the whole claim of MCP-01 is that the surface is DERIVED, and a verb justified twice is a verb whose " +
      "derivation nobody checked.",
  );
  // The deviation population is the reason this direction has two halves; if it
  // ever empties, the second half stops being exercised and should be revisited
  // rather than left to pass over nothing.
  assert.ok(
    entriesOfKind(ANNO_VERB_REGISTER, "manifest-deviation").length > 0,
    "no entry carries the manifest-deviation kind -- the second half of this direction would pass over an empty set",
  );
});

test("DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md", () => {
  const declaredIds = declaredRequirementIds();
  assert.ok(declaredIds.size > 0, "no requirement ids were parsed out of .planning/REQUIREMENTS.md -- the membership check would pass vacuously");
  const problems = ANNO_VERB_REGISTER.flatMap((entry) => basisProblems(entry, ROOT, declaredIds));
  assert.deepEqual(problems, [], `basis problems:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 5b: an advisory line citation is VERIFIED, never trusted -- the discipline the register's own header states", () => {
  const problems = ANNO_VERB_REGISTER.flatMap((entry) => lineCitationProblems(entry));
  assert.deepEqual(problems, [], `line-citation drift:\n  ${problems.join("\n  ")}`);
});

test("DIRECTION 6 (ordering): every direction yields identical results over reversed copies of BOTH the register and the definition table", () => {
  const manifestSuffixes = manifestVerbSuffixes();
  const forward = scanVerdict(ANNO_VERB_REGISTER, ANNO_TOOL_DEFINITIONS, manifestSuffixes);
  const reversed = scanVerdict(
    [...ANNO_VERB_REGISTER].reverse(),
    [...ANNO_TOOL_DEFINITIONS].reverse(),
    manifestSuffixes,
  );
  assert.deepEqual(
    reversed,
    forward,
    "the register's verdict changed when the register array and the definition table were reversed -- a direction " +
      "that depends on array order is a direction whose result depends on where someone happened to paste an entry",
  );
  // Non-vacuity for this direction specifically: comparing two empty verdicts
  // would pass while proving nothing about order-independence.
  assert.ok(forward.unclassified.length > 0, "the reversed comparison ran over an empty unclassified population");
});

test("the register's exported lookup agrees with the array it reads -- one lookup, shared by every later consumer", () => {
  for (const entry of ANNO_VERB_REGISTER) {
    assert.equal(annoRegisterEntryFor(entry.verb), entry, `${entry.verb}: the exported lookup did not return its own entry`);
  }
  assert.equal(annoRegisterEntryFor("anno_not_a_verb"), undefined);
  // The surface's own curated list and the definition table must not have
  // drifted, or every direction above is scanning a different surface than the
  // one the runner dispatches.
  assert.deepEqual([...CURATED_ANNO_TOOLS], surfaceNames());
});

// --- planted violations: each drives the SAME exported predicate the real scan
// --- calls, never a copy of the rule.

/** A clean synthetic entry, used as the negative control and as the base every
 * planted violation is derived from. Its verb is a real surface verb already in
 * the register, so `orphanedEntries` has nothing to report about it. */
const CLEAN_SYNTHETIC: AnnoVerbRegisterEntry = {
  verb: "anno_search",
  kind: "unclassified",
  consumers: [{ path: "src/mcp/vice/anno-derive.ts", symbol: "searchAnnotations" }],
  requirements: ["STORE-06"],
  rationale: "a synthetic clean entry, used only to drive the predicates as a negative control",
};

test("planted violation (completeness): a surface verb with NO register entry is reported by the same predicate the real scan calls", () => {
  const manifestSuffixes = manifestVerbSuffixes();
  const names = [...surfaceNames(), "anno_synthetic_unregistered"];
  const reported = unregisteredVerbs(ANNO_VERB_REGISTER, names, manifestSuffixes);
  assert.deepEqual(reported, ["anno_synthetic_unregistered"]);
  // The negative control: the same predicate over the real surface reports none.
  assert.deepEqual(unregisteredVerbs(ANNO_VERB_REGISTER, surfaceNames(), manifestSuffixes), []);
});

test("planted violation (basis): an entry citing NO requirement id is reported by the same predicate the real scan calls", () => {
  const declaredIds = declaredRequirementIds();
  const noRequirement: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, requirements: [] };
  const noConsumer: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, consumers: [] };
  const absentPath: AnnoVerbRegisterEntry = {
    ...CLEAN_SYNTHETIC,
    consumers: [{ path: "src/mcp/vice/anno-does-not-exist.ts", symbol: "nothing" }],
  };
  const undeclaredId: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, requirements: ["NOPE-99"] };

  assert.match(basisProblems(noRequirement, ROOT, declaredIds).join("\n"), /cites no requirement id/);
  assert.match(basisProblems(noConsumer, ROOT, declaredIds).join("\n"), /names no consumer/);
  assert.match(basisProblems(absentPath, ROOT, declaredIds).join("\n"), /does not exist on disk/);
  assert.match(basisProblems(undeclaredId, ROOT, declaredIds).join("\n"), /NOT declared in \.planning\/REQUIREMENTS\.md/);
});

test("planted violation (orphan): an entry naming a verb that is NOT on the surface is reported by the same predicate the real scan calls", () => {
  const orphan: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, verb: "anno_retired_verb" };
  assert.deepEqual(orphanedEntries([orphan], surfaceNames()), ["anno_retired_verb"]);
});

test("planted violation (collision): an entry shadowing a manifest-classified verb, and a deviation entry the manifest does not classify, are both reported by the same predicate the real scan calls", () => {
  const manifestSuffixes = manifestVerbSuffixes();
  const shadow: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, verb: "anno_get_blocks" };
  const falseDeviation: AnnoVerbRegisterEntry = { ...CLEAN_SYNTHETIC, kind: "manifest-deviation" };
  assert.match(collisionProblems(shadow, manifestSuffixes).join("\n"), /would shadow the manifest/);
  assert.match(collisionProblems(falseDeviation, manifestSuffixes).join("\n"), /a deviation from a contract that does not exist/);
});

test("planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates", () => {
  const manifestSuffixes = manifestVerbSuffixes();
  assert.deepEqual(basisProblems(CLEAN_SYNTHETIC, ROOT, declaredRequirementIds()), []);
  assert.deepEqual(orphanedEntries([CLEAN_SYNTHETIC], surfaceNames()), []);
  assert.deepEqual(collisionProblems(CLEAN_SYNTHETIC, manifestSuffixes), []);
  assert.deepEqual(lineCitationProblems(CLEAN_SYNTHETIC), []);
  assert.deepEqual(unregisteredVerbs([CLEAN_SYNTHETIC], ["anno_search"], manifestSuffixes), []);
});
