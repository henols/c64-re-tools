// anno-verb-coverage.test.ts -- the non-vacuity/planted-violation proof for
// the FLOW-01 guard (11.1-CONTEXT.md, D-11.1-02).
//
// `scripts/check-skill-tool-coverage.mjs` checked `r2000_*` MCP TOOL names
// in skill prose, but nothing checked `r2000` CLI VERBS at all -- so
// `gen-enums`, `export-lbl` and `import-lbl` (R2000-13/-14/-15's own
// delivery path) reached `main` documented in zero skill files, with
// nothing catching it. `scripts/lib/anno-cli-verbs.mjs` closes that gap by
// PARSING the verb list from `anno-cli.ts`'s own dispatch switch, and this
// file is the committed proof that the parser and the CI script that
// imports it both actually work -- a guard is only as good as the evidence
// it was ever awake.
//
// This file imports the SAME module the CI script imports (never a second
// copy of the parser), so proving the predicate here proves the predicate
// the CI script runs in production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAnnoCliVerbs, verbsMissingFromSkills, ANNO_CLI_VERB_FLOOR } from "../../../scripts/lib/anno-cli-verbs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const SKILLS_DIR = join(ROOT, "src", "skills");
const CI_SCRIPT = join(ROOT, "scripts", "check-skill-tool-coverage.mjs");

/**
 * The verbs `anno-cli.ts`'s dispatch switch really has, hand-maintained on
 * purpose. This is a FROZEN REGISTRY, not a convenience list: the real-source
 * parse test below compares the live parse against it with `deepEqual`, so
 * adding a verb to the switch without adding it here FAILS -- which is the
 * entire point. Deriving this array from `parseAnnoCliVerbs()` (the very
 * function under test) would turn every assertion below into a tautology that
 * passes no matter what the parser does. `coverage` was added by plan 19-04
 * alongside `ANNO_CLI_VERB_FLOOR`'s rise from 7 to 8; both counts move
 * together, deliberately, because they measure the same fact.
 */
const REAL_VERBS = ["bootstrap", "coverage", "export-asm", "export-lbl", "gen-enums", "import-lbl", "render-memmap", "verify"];

/**
 * The verbs the two SYNTHETIC sources below happen to carry. Deliberately
 * separate from `REAL_VERBS`: those sources are fixtures with their own fixed
 * shapes (the planted-violation one exists to prove an 8th, undocumented case
 * is caught; the commented-out one to prove a commented case is not counted),
 * not reflections of the real dispatch switch. Before plan 19-04 the two lists
 * coincided at seven entries and the comment-hygiene test reused `REAL_VERBS`;
 * adding the real 8th verb separated them, and they must stay separated --
 * editing a fixture to chase the real switch would destroy the property the
 * fixture was written to prove.
 */
const SYNTHETIC_FIXTURE_VERBS = ["bootstrap", "export-asm", "export-lbl", "gen-enums", "import-lbl", "render-memmap", "verify"];

/** Same file-set convention as `check-skill-tool-coverage.mjs`'s own
 * `walkSkills()`: every `.md`/`.mjs` file under `src/skills/`,
 * skipping symlinks and `node_modules`. Kept local rather than imported --
 * the CI script executes its whole check at import time, so importing it
 * from a test would re-run the live gate instead of letting this file
 * drive the shared module in isolation. */
function walkSkillFiles(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walkSkillFiles(p, acc);
    else if (/\.(md|mjs)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

function realSkillTexts(): string[] {
  return walkSkillFiles(SKILLS_DIR).map((f) => readFileSync(f, "utf8"));
}

// A synthetic module carrying the SAME `switch (verb) { case "<verb>": ... }`
// shape `anno-cli.ts` uses, with one extra, real (non-commented) case --
// the planted violation. `ghost-verb` is a verb name that will never exist
// in the real skill corpus, so `verbsMissingFromSkills()` reporting it is
// unambiguous evidence the guard fires on a genuinely new, undocumented
// verb.
const PLANTED_VIOLATION_SRC = `
function dummyDispatch(verb) {
  switch (verb) {
    case "bootstrap":
      return 1;
    case "export-asm":
      return 2;
    case "verify":
      return 3;
    case "gen-enums":
      return 4;
    case "export-lbl":
      return 5;
    case "import-lbl":
      return 6;
    case "render-memmap":
      return 7;
    case "ghost-verb":
      return 8;
    default:
      return 0;
  }
}
`;

// Same shape, but the 8th case is hidden inside a block comment and a 9th
// is hidden inside a line comment -- neither must be counted as a verb.
const COMMENTED_OUT_CASE_SRC = `
function dummyDispatch(verb) {
  switch (verb) {
    case "bootstrap":
      return 1;
    case "export-asm":
      return 2;
    case "verify":
      return 3;
    case "gen-enums":
      return 4;
    case "export-lbl":
      return 5;
    case "import-lbl":
      return 6;
    case "render-memmap":
      return 7;
    /* case "block-commented-ghost": return 8; */
    // case "line-commented-ghost":
    default:
      return 0;
  }
}
`;

test("real-source parse: anno-cli.ts's dispatch switch yields exactly the 8 known verbs, never 'default'", () => {
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  assert.deepEqual(verbs, [...REAL_VERBS].sort());
  assert.ok(!verbs.includes("default"), "the switch's own default: branch must never be parsed as a verb");
});

test("positive control: every real verb is named by at least one real skill file (the Task 1 property, restated mechanically)", () => {
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  const missing = verbsMissingFromSkills(verbs, realSkillTexts());
  assert.deepEqual(missing, [], `expected no verb missing from the real skill corpus, got: ${missing.join(", ")}`);
});

test("planted violation: an 8th, genuinely new case is parsed and reported missing, while a real, documented verb is not", () => {
  const verbs = parseAnnoCliVerbs(PLANTED_VIOLATION_SRC);
  assert.equal(verbs.length, 8);
  assert.ok(verbs.includes("ghost-verb"), "the planted 8th case must be parsed as a verb");

  const missing = verbsMissingFromSkills(verbs, realSkillTexts());
  assert.ok(missing.includes("ghost-verb"), "the guard must fire on a new, undocumented verb");
  assert.ok(!missing.includes("export-asm"), "the guard must NOT fire on a verb that is genuinely documented");

  // Demonstration that this test is not vacuous itself: if the predicate
  // were stubbed to always report nothing missing, this assertion is what
  // would catch it -- recorded in the SUMMARY as the inversion check.
  const stubbedAlwaysEmpty = () => [] as string[];
  assert.notDeepEqual(stubbedAlwaysEmpty(), missing);
});

test("comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb", () => {
  const verbs = parseAnnoCliVerbs(COMMENTED_OUT_CASE_SRC);
  assert.deepEqual(verbs, [...SYNTHETIC_FIXTURE_VERBS].sort());
  assert.ok(!verbs.includes("block-commented-ghost"));
  assert.ok(!verbs.includes("line-commented-ghost"));
});

test("non-vacuity floor: ANNO_CLI_VERB_FLOOR matches the measured true count and the real parse meets it", () => {
  assert.equal(ANNO_CLI_VERB_FLOOR, 8);
  const src = readFileSync(join(HERE, "anno-cli.ts"), "utf8");
  const verbs = parseAnnoCliVerbs(src);
  assert.ok(verbs.length >= ANNO_CLI_VERB_FLOOR);
});

test("the CI script's live execution path: `node scripts/check-skill-tool-coverage.mjs` exits 0 with 'OK' in stdout", () => {
  assert.ok(existsSync(CI_SCRIPT), `expected the CI script to exist at ${CI_SCRIPT}`);
  const result = spawnSync(process.execPath, [CI_SCRIPT], { encoding: "utf8", cwd: ROOT });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK/);
  assert.match(result.stdout, /r2000 CLI verbs: \d+ parsed/);
});
