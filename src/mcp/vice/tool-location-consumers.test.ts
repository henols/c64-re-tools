// node:test coverage of the CLOSED consumer set for the four declared
// tool-location environment variables -- VICE_BIN (x64sc), ACME_BIN (acme),
// ACME (acme-lib), GHIDRA_HOME (ghidra) -- LOC-02.
//
// WHY THIS FILE EXISTS: plans 60-01 through 60-04 rewired backend-detect.mts,
// broker-launch.mts, vice-broker.mts, host-tool.mts and vice-proxy.ts to
// resolve every tool location through tool-location.mts's resolveTool() seam
// instead of reading process.env directly. LOC-02 asks that "the precedence
// order exists in exactly one place" be a MECHANICAL assertion rather than a
// claim resting on care -- this file is that assertion: after this phase, no
// production module under src/mcp/vice may name one of the four declared
// tool-location environment variables, except the one declared exception
// below. It is the same closed-consumer-set idiom hostpath-consumers.test.ts
// already established for hostpath.ts's own consumer set (SEAM-06's own
// header), copied here over a different token set.
//
// THE ONE DECLARED EXCEPTION (PD-10): acme-gate.ts reads
// process.env.ACME_BIN directly. It is TEST-ONLY -- its own header says so,
// says it must never be imported by a production module, and says ACME_BIN
// may never be renamed because CI binds the exact name -- but it is a plain
// .ts file directly under src/mcp/vice, so the module walk below sees it.
// Naming it here, with the reason, is honest; excluding it by widening the
// walk's filters would hide a real reader.
//
// tool-location.mts ITSELF is absent from every one of the four expected
// arrays (PD-11) -- it reads the variable through a computed lookup on the
// declaration's own `envVar` field (`env[envVarName]`), never a literal
// name, which is the strongest possible statement of LOC-02: the precedence
// order exists in exactly one place, and that place does not even spell the
// four names out as source-level literals.
//
// WHAT NOT TO DO:
//   - Never widen an expected array to make a red scan green. A module still
//     reading one of the four names is a rewiring defect to fix in its own
//     module, not an entry to add here.
//   - Never match a bare occurrence of one of the four names. Only a real
//     property-access or bracket-index read on an env-like binding counts;
//     a comment or a string-literal mention must not be reported (Test 7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Strips `//` line comments and `/* ... *\/` block comments, returning the
 * comment-stripped source as ONE newline-joined string. Copied VERBATIM from
 * `hostpath-consumers.test.ts` (its own WR-02 fix, 10-REVIEW.md) rather than
 * re-derived -- there is exactly one comment stripper in this tree's test
 * suite, not a second copy that can drift from the first. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return; // still unterminated -- drop the rest of this line
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true; // unterminated on this line -- resumes on later lines
        return;
      }
      // Opens and closes on the same line (`/* ... */ code();`) -- the
      // remainder after the closing `*/` is still real code/comment text.
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return; // whole-line `//` comment -- dropped
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

/** The complete top-level module list this repo ships: every `*.ts`/`*.mts`
 * directly under `src/mcp/vice`, excluding `*.test.*` files. Copied VERBATIM
 * from `hostpath-consumers.test.ts`. */
function topLevelProductionModules(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

/** Builds a predicate that matches a real property-access or bracket-index
 * read of `name` (one of the four declared tool-location environment-
 * variable names) against COMMENT-STRIPPED source, in the shapes:
 *   - a dotted read on any binding whose identifier ends in `env`
 *     (case-insensitive) -- covers `process.env.<NAME>` itself, since `env`
 *     is such a binding, and covers an aliased or destructured binding like
 *     `const hostEnv = process.env; ... hostEnv.<NAME>` (Test 5) -- the
 *     shape the pre-rewiring code in this tree actually used;
 *   - a bracket read with a single- or double-quoted string literal, on the
 *     same class of env-like binding (Test 6).
 * Anchored on a word boundary at both ends of `name`, so `ACME` cannot match
 * inside `ACME_BIN` and `ACME_BIN` cannot match a source that only reads
 * `ACME` (Test 8) -- `_` is a word character, so `\b` does not fire between
 * `ACME` and the `_BIN` that follows it in a genuine `ACME_BIN` read. Never
 * matches a bare occurrence of `name` with no env-like accessor in front of
 * it -- the whole reason a comment or string-literal mention (Test 7) is
 * harmless once `stripCommentLines()` has already removed the comment case. */
function envReadPredicateFor(name: string): (strippedSrc: string) => boolean {
  const dottedRe = new RegExp(`\\b(?:[A-Za-z_$][\\w$]*)?env\\.${name}\\b`, "i");
  const bracketRe = new RegExp(`\\b(?:[A-Za-z_$][\\w$]*)?env\\s*\\[\\s*(["'])${name}\\1\\s*\\]`, "i");
  return (strippedSrc: string) => dottedRe.test(strippedSrc) || bracketRe.test(strippedSrc);
}

/** The set of production modules whose stripped source reads `name` through
 * `envReadPredicateFor(name)`, sorted -- so every assertion over it is
 * order-independent and comparable with `assert.deepEqual` against a named
 * array (never a bare count, never a subset check). */
function envReaders(name: string): string[] {
  const predicate = envReadPredicateFor(name);
  const readers: string[] = [];
  for (const moduleName of topLevelProductionModules()) {
    const src = readFileSync(join(HERE, moduleName), "utf8");
    const stripped = stripCommentLines(src);
    if (predicate(stripped)) readers.push(moduleName);
  }
  return readers.sort();
}

const VICE_BIN = "VICE_BIN";
const ACME_BIN = "ACME_BIN";
const ACME = "ACME";
const GHIDRA_HOME = "GHIDRA_HOME";

const EXPECTED_VICE_BIN_READERS: string[] = [];
const EXPECTED_ACME_READERS: string[] = [];
const EXPECTED_GHIDRA_HOME_READERS: string[] = [];
// PD-10: acme-gate.ts is the ONE declared exception. It is test-only, must
// never be imported by a production module, and its ACME_BIN name may never
// be renamed because CI binds the exact name -- see acme-gate.ts's own
// header for the full rationale.
const EXPECTED_ACME_BIN_READERS: string[] = ["acme-gate.ts"];

test("Plan 60-05 Test 1 (tracer): the emulator-binary variable's closed consumer set is empty", () => {
  assert.deepEqual(envReaders(VICE_BIN), EXPECTED_VICE_BIN_READERS);
});

test("Plan 60-05 Test 2: the ACME standard-library and Ghidra variables' closed consumer sets are both empty", () => {
  assert.deepEqual(envReaders(ACME), EXPECTED_ACME_READERS);
  assert.deepEqual(envReaders(GHIDRA_HOME), EXPECTED_GHIDRA_HOME_READERS);
});

test("Plan 60-05 Test 3: the ACME binary variable's closed consumer set is exactly the one declared test-only exception", () => {
  assert.deepEqual(envReaders(ACME_BIN), EXPECTED_ACME_BIN_READERS);
});

test("Plan 60-05 Test 4 (non-vacuity): a genuine process.env.<NAME> read is reported, for each of the four names", () => {
  for (const name of [VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME]) {
    const planted = `export function useIt() {\n  return process.env.${name};\n}\n`;
    assert.equal(
      envReadPredicateFor(name)(stripCommentLines(planted)),
      true,
      `a genuine process.env.${name} read must be reported -- if this fails, the absence assertions above are not capable of catching a real violation`,
    );
  }
});

test("Plan 60-05 Test 5 (non-vacuity, shorthand form): an aliased/destructured env binding's dotted read is reported, for each of the four names", () => {
  for (const name of [VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME]) {
    const planted = `const hostEnv = process.env;\nexport function useIt() {\n  return hostEnv.${name};\n}\n`;
    assert.equal(
      envReadPredicateFor(name)(stripCommentLines(planted)),
      true,
      `an aliased env binding's dotted ${name} read must be reported -- this is the shape the pre-rewiring code actually used, and the shape a regression would most plausibly take`,
    );
  }
});

test("Plan 60-05 Test 6 (non-vacuity, bracket form): a bracket-indexed env read is reported, for each of the four names", () => {
  for (const name of [VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME]) {
    const doubleQuoted = `export function useIt() {\n  return process.env["${name}"];\n}\n`;
    const singleQuoted = `export function useIt() {\n  return process.env['${name}'];\n}\n`;
    assert.equal(envReadPredicateFor(name)(stripCommentLines(doubleQuoted)), true, `a double-quoted bracket ${name} read must be reported`);
    assert.equal(envReadPredicateFor(name)(stripCommentLines(singleQuoted)), true, `a single-quoted bracket ${name} read must be reported`);
  }
});

test("Plan 60-05 Test 7 (clean control): a name mentioned only in a line comment, a block comment and a string literal is not reported", () => {
  for (const name of [VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME]) {
    const planted = [
      `// this module never reads process.env.${name}`,
      `/* also never reads env.${name} here */`,
      `export const EXAMPLE_TEXT = "the ${name} environment variable is refused by name";`,
      `export function useIt() { return EXAMPLE_TEXT; }`,
      "",
    ].join("\n");
    assert.equal(
      envReadPredicateFor(name)(stripCommentLines(planted)),
      false,
      `a comment-only and string-literal-only mention of ${name} must not be reported`,
    );
  }
});

test("Plan 60-05 Test 8 (control that the token boundary holds): the ACME predicate does not match an ACME_BIN-only source and vice versa", () => {
  const acmeBinOnly = stripCommentLines(`export function useIt() {\n  return process.env.ACME_BIN;\n}\n`);
  const acmeOnly = stripCommentLines(`export function useIt() {\n  return process.env.ACME;\n}\n`);
  assert.equal(envReadPredicateFor(ACME)(acmeBinOnly), false, "the ACME predicate must not match inside an ACME_BIN read");
  assert.equal(envReadPredicateFor(ACME_BIN)(acmeOnly), false, "the ACME_BIN predicate must not match an ACME-only read");
});

test("Plan 60-05 Test 9 (the walk sees what it claims to): the module list includes the five modules this phase rewired", () => {
  const modules = topLevelProductionModules();
  for (const name of ["backend-detect.mts", "broker-launch.mts", "vice-broker.mts", "host-tool.mts", "vice-proxy.ts"]) {
    assert.ok(modules.includes(name), `${name} (one of the five modules this phase rewired) must be present in the module walk`);
  }
});
