#!/usr/bin/env node
// proof04-independence.test.ts
//
// Phase 44, plan 44-01, Task 2. Success Criterion 2's own structural
// assertion: the SUBJECT producer (`proof04-subject-dxa.mjs`) and the ORACLE
// producer (`proof04-oracle-memmap.mjs`) never import each other's domain,
// and neither names the other's output artifact basename. The JOIN driver
// (`proof04-reconcile.mjs`) calls the shipped `reconcileObservedExecution()`
// exactly once. Colocated with the three scripts it checks (D-P5) rather
// than under `src/mcp/vice/` -- this file reads `.planning/phases/**` paths
// and would become one more consumer that breaks when the milestone
// archives the phase directory, a cost this project has already measured at
// twelve-plus consumers. It is therefore run explicitly by this plan's own
// verify gate, not picked up by `npm run test:automated`'s cwd-scoped glob.
//
// WHY THE PREDICATE IS SPECIFIER-SCOPED, NOT RAW-SUBSTRING-SCOPED: both
// producers' own headers deliberately name the modules they must not reach,
// in prose, as part of stating their boundary -- a `src.includes(...)` check
// over the WHOLE file would red on correct code. `stripComments()` below
// removes `//` line comments and `/* */` block comments (respecting string
// and template literals, so a `/` inside a quoted path never opens a
// comment), and every assertion runs over the stripped remainder.
//
// NON-VACUOUS BY CONSTRUCTION (ENGINEERING_RULES.md section 6): the two
// PLANTED cases below drive the SAME exported `findForbiddenTokens()`
// function the four real assertions call -- never a second copy -- and prove
// it distinguishes a forbidden specifier in a real import position from the
// same token appearing only inside a comment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUBJECT_PATH = join(HERE, "proof04-subject-dxa.mjs");
const ORACLE_PATH = join(HERE, "proof04-oracle-memmap.mjs");
const RECONCILE_PATH = join(HERE, "proof04-reconcile.mjs");

/**
 * Removes `//` line comments and `/* ... *\/` block comments from `source`,
 * respecting single-quoted, double-quoted and template-literal strings (a
 * `/` inside a quoted path never opens a comment). Returns the stripped
 * remainder -- every structural assertion in this file runs over THIS, never
 * over the raw source.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const c = source[i]!;
    const next = i + 1 < n ? source[i + 1]! : "";

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < n) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) {
        inString = false;
        stringChar = "";
      }
      i += 1;
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inString = true;
      stringChar = c;
      out += c;
      i += 1;
      continue;
    }

    out += c;
    i += 1;
  }
  return out;
}

/**
 * Reports which of `forbiddenTokens` appear anywhere in `source`'s
 * comment-stripped remainder. Used BOTH by the four real structural
 * assertions below and by the PLANTED non-vacuity cases -- the same code
 * path, never a copy of it.
 */
export function findForbiddenTokens(source: string, forbiddenTokens: readonly string[]): string[] {
  const stripped = stripComments(source);
  return forbiddenTokens.filter((token) => stripped.includes(token));
}

/** Counts occurrences of `${name}(` in `source`'s comment-stripped
 * remainder -- used for the join driver's "exactly one call" assertion. */
export function countCallSites(source: string, name: string): number {
  const stripped = stripComments(source);
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\(`, "g");
  return (stripped.match(re) ?? []).length;
}

// ---------------------------------------------------------------------------
// Assertion 1: the subject producer never imports the oracle's domain.
// ---------------------------------------------------------------------------

test("subject producer (proof04-subject-dxa.mjs) never imports the oracle's domain", () => {
  const src = readFileSync(SUBJECT_PATH, "utf8");
  const forbidden = ["text-protocol", "textmon-memmap", "evid-ingest", "evid-reconcile", "probe-harness", "stock-protocol", "anno-d64"];
  const found = findForbiddenTokens(src, forbidden);
  assert.deepEqual(found, [], `subject producer names forbidden oracle-domain specifiers: ${JSON.stringify(found)}`);
});

// ---------------------------------------------------------------------------
// Assertion 2: the oracle producer never imports the subject's domain.
// ---------------------------------------------------------------------------

test("oracle producer (proof04-oracle-memmap.mjs) never imports the subject's domain", () => {
  const src = readFileSync(ORACLE_PATH, "utf8");
  const forbidden = ["dxa-run", "dxa-partition", "dxa-listing", "dxa-blocks", "block-class", "anno-store", "anno-tools", "evid-reconcile"];
  const found = findForbiddenTokens(src, forbidden);
  assert.deepEqual(found, [], `oracle producer names forbidden subject-domain specifiers: ${JSON.stringify(found)}`);
});

// ---------------------------------------------------------------------------
// Assertion 3: neither producer names the other's output artifact basename
// -- the semantic half of the independence claim (not merely "does not
// import", but "cannot read the other's output").
// ---------------------------------------------------------------------------

test("subject producer never names the oracle's output artifact basename", () => {
  const src = readFileSync(SUBJECT_PATH, "utf8");
  const found = findForbiddenTokens(src, ["oracle-memmap.json"]);
  assert.deepEqual(found, [], `subject producer names the oracle artifact basename: ${JSON.stringify(found)}`);
});

test("oracle producer never names the subject's output artifact basename", () => {
  const src = readFileSync(ORACLE_PATH, "utf8");
  const found = findForbiddenTokens(src, ["subject-dxa.json"]);
  assert.deepEqual(found, [], `oracle producer names the subject artifact basename: ${JSON.stringify(found)}`);
});

// ---------------------------------------------------------------------------
// Assertion 4: the join driver calls reconcileObservedExecution exactly once.
// ---------------------------------------------------------------------------

test("join driver (proof04-reconcile.mjs) calls reconcileObservedExecution exactly once", () => {
  const src = readFileSync(RECONCILE_PATH, "utf8");
  const count = countCallSites(src, "reconcileObservedExecution");
  assert.equal(count, 1, `expected exactly one reconcileObservedExecution( call site, found ${count}`);
});

// ---------------------------------------------------------------------------
// PLANTED non-vacuity proof (ENGINEERING_RULES.md section 6): the SAME
// exported findForbiddenTokens() the four assertions above call is exercised
// against a synthetic module that carries a forbidden specifier BOTH in a
// real import position and inside a comment -- proving the guard has teeth
// AND that it does not red on the producers' own boundary documentation.
// ---------------------------------------------------------------------------

const PLANTED_VIOLATION_SRC = `import { doThing } from "./text-protocol.ts";\nconsole.log("ok");\n`;
const PLANTED_CLEAN_SRC = `// this module must never import text-protocol.ts -- boundary documentation\nconsole.log("ok");\n`;

test("PLANTED violation: a forbidden specifier in a real import position IS reported", () => {
  const found = findForbiddenTokens(PLANTED_VIOLATION_SRC, ["text-protocol"]);
  assert.deepEqual(found, ["text-protocol"], "the planted import-position violation was not detected");
});

test("PLANTED violation: the same token appearing only inside a comment is NOT reported", () => {
  const found = findForbiddenTokens(PLANTED_CLEAN_SRC, ["text-protocol"]);
  assert.deepEqual(found, [], `a comment-only occurrence was incorrectly reported as a violation: ${JSON.stringify(found)}`);
});
