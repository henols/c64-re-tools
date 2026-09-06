// proof-evidence-integrity.test.ts -- integrity checks on Phase 38 evidence files
// (PROOF-01, PROOF-02, PROOF-03).
//
// Gap G2 coverage (6 behavioral requirements):
//   a) Every outcome-line key in evidence files is declared in SCHEMA.md
//   b) Verdict keys stay inside their SCHEMA-declared domains
//   c) PROOF01_FALSE_POSITIVES is the structurally-uncomputable refusal string, never a bare integer
//   d) PROOF01_DATA_RECOVERY_PCT sits beside FIXTURE_* keys in the same file
//   e) README.md has exactly one TEST_AUTOMATED_BASELINE line
//   f) Document-ordering property: site enumeration before Ghidra, derivation before verdict
//
// Reads committed evidence files from .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/
// using repoRoot() resolution, as per the absorbed-answer-key.test.ts precedent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Resolve evidence directory via repoRoot() to work across worktrees
const EVIDENCE_DIR = join(repoRoot({ from: HERE }), ".planning", "phases", "38-proof-01-03-on-real-cracked-code", "evidence");

// Read all required files
const SCHEMA_PATH = join(EVIDENCE_DIR, "SCHEMA.md");
const README_PATH = join(EVIDENCE_DIR, "README.md");
const PROOF01_PATH = join(EVIDENCE_DIR, "proof01-dxa-real-release.md");
const PROOF02_LOADER_PATH = join(EVIDENCE_DIR, "proof02-loader-stage.md");
const PROOF02_DEPACKED_PATH = join(EVIDENCE_DIR, "proof02-depacked-capture.md");
const PROOF02_DISPATCH_PATH = join(EVIDENCE_DIR, "proof02-computed-dispatch.md");
const PROOF03_PATH = join(EVIDENCE_DIR, "proof03-bank-boundary.md");

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Extracts all outcome-line keys from a markdown file.
 * An outcome line is at column 0 in the format "KEY: value".
 * Returns a Set of unique keys.
 */
function extractOutcomeLineKeys(text: string): Set<string> {
  const keys = new Set<string>();
  // Match lines that start at column 0 with pattern KEY: (at least one colon-separated word)
  const linePattern = /^([A-Z_][A-Z0-9_]*): /m;
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*): /);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/**
 * Extracts all PROOF0[123]_/FIXTURE_/PIVOT_ outcome-line keys declared in SCHEMA.md.
 * These are wrapped in backticks in the schema.
 */
function extractSchemaKeys(schemaText: string): Set<string> {
  const keys = new Set<string>();
  // Match backtick-wrapped keys like `PROOF01_RELEASE_ID`, `FIXTURE_DATA_RECOVERY_PCT`, etc.
  const pattern = /`((?:PROOF0[123]|FIXTURE|PIVOT)_[A-Z_0-9]+)`/g;
  let match;
  while ((match = pattern.exec(schemaText)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// =============================================================================
// Behavior (a): Every outcome-line key in evidence files is declared in SCHEMA.md
// =============================================================================

test("(a) all outcome-line keys in proof01-dxa-real-release.md are declared in SCHEMA.md", (t) => {
  const schema = readFile(SCHEMA_PATH);
  const proof01 = readFile(PROOF01_PATH);

  const schemaKeys = extractSchemaKeys(schema);
  const proof01Keys = extractOutcomeLineKeys(proof01);

  // Filter to only PROOF-family keys (ignore generic keys like BROKER_STATE)
  const proof01ProofKeys = new Set([...proof01Keys].filter((k) => k.match(/^PROOF0[123]_|^FIXTURE_|^PIVOT_/)));

  const undeclaredKeys: string[] = [];
  for (const key of proof01ProofKeys) {
    if (!schemaKeys.has(key)) {
      undeclaredKeys.push(key);
    }
  }

  assert.equal(
    undeclaredKeys.length,
    0,
    `proof01-dxa-real-release.md emits outcome-line keys not declared in SCHEMA.md: ${undeclaredKeys.join(", ")}`,
  );
});

test("(a) all outcome-line keys in proof02-loader-stage.md are declared in SCHEMA.md", (t) => {
  const schema = readFile(SCHEMA_PATH);
  const proof02 = readFile(PROOF02_LOADER_PATH);

  const schemaKeys = extractSchemaKeys(schema);
  const proof02Keys = extractOutcomeLineKeys(proof02);

  const proof02ProofKeys = new Set([...proof02Keys].filter((k) => k.match(/^PROOF0[123]_|^FIXTURE_|^PIVOT_/)));

  const undeclaredKeys: string[] = [];
  for (const key of proof02ProofKeys) {
    if (!schemaKeys.has(key)) {
      undeclaredKeys.push(key);
    }
  }

  assert.equal(
    undeclaredKeys.length,
    0,
    `proof02-loader-stage.md emits outcome-line keys not declared in SCHEMA.md: ${undeclaredKeys.join(", ")}`,
  );
});

test("(a) all outcome-line keys in proof02-depacked-capture.md are declared in SCHEMA.md", (t) => {
  const schema = readFile(SCHEMA_PATH);
  const proof02 = readFile(PROOF02_DEPACKED_PATH);

  const schemaKeys = extractSchemaKeys(schema);
  const proof02Keys = extractOutcomeLineKeys(proof02);

  const proof02ProofKeys = new Set([...proof02Keys].filter((k) => k.match(/^PROOF0[123]_|^FIXTURE_|^PIVOT_/)));

  const undeclaredKeys: string[] = [];
  for (const key of proof02ProofKeys) {
    if (!schemaKeys.has(key)) {
      undeclaredKeys.push(key);
    }
  }

  assert.equal(
    undeclaredKeys.length,
    0,
    `proof02-depacked-capture.md emits outcome-line keys not declared in SCHEMA.md: ${undeclaredKeys.join(", ")}`,
  );
});

test("(a) all outcome-line keys in proof02-computed-dispatch.md are declared in SCHEMA.md", (t) => {
  const schema = readFile(SCHEMA_PATH);
  const proof02 = readFile(PROOF02_DISPATCH_PATH);

  const schemaKeys = extractSchemaKeys(schema);
  const proof02Keys = extractOutcomeLineKeys(proof02);

  const proof02ProofKeys = new Set([...proof02Keys].filter((k) => k.match(/^PROOF0[123]_|^FIXTURE_|^PIVOT_/)));

  const undeclaredKeys: string[] = [];
  for (const key of proof02ProofKeys) {
    if (!schemaKeys.has(key)) {
      undeclaredKeys.push(key);
    }
  }

  assert.equal(
    undeclaredKeys.length,
    0,
    `proof02-computed-dispatch.md emits outcome-line keys not declared in SCHEMA.md: ${undeclaredKeys.join(", ")}`,
  );
});

test("(a) all outcome-line keys in proof03-bank-boundary.md are declared in SCHEMA.md", (t) => {
  const schema = readFile(SCHEMA_PATH);
  const proof03 = readFile(PROOF03_PATH);

  const schemaKeys = extractSchemaKeys(schema);
  const proof03Keys = extractOutcomeLineKeys(proof03);

  const proof03ProofKeys = new Set([...proof03Keys].filter((k) => k.match(/^PROOF0[123]_|^FIXTURE_|^PIVOT_/)));

  const undeclaredKeys: string[] = [];
  for (const key of proof03ProofKeys) {
    if (!schemaKeys.has(key)) {
      undeclaredKeys.push(key);
    }
  }

  assert.equal(
    undeclaredKeys.length,
    0,
    `proof03-bank-boundary.md emits outcome-line keys not declared in SCHEMA.md: ${undeclaredKeys.join(", ")}`,
  );
});

// =============================================================================
// Behavior (b): Verdict keys stay inside their SCHEMA-declared domains
// =============================================================================

/**
 * Extracts the value of a single outcome-line by key (last occurrence wins).
 */
function getOutcomeLineValue(text: string, key: string): string | null {
  const pattern = new RegExp(`^${key}: (.*)$`, "m");
  let match;
  let lastMatch = null;
  // Keep matching to get the last occurrence
  const lines = text.split("\n");
  for (const line of lines) {
    match = line.match(new RegExp(`^${key}: (.*)`));
    if (match) {
      lastMatch = match[1];
    }
  }
  return lastMatch;
}

test("(b) PROOF02_COMPUTED_DISPATCH values stay in domain (resolved|unresolved|not-exercised)", (t) => {
  const proof02_dispatch = readFile(PROOF02_DISPATCH_PATH);
  const value = getOutcomeLineValue(proof02_dispatch, "PROOF02_COMPUTED_DISPATCH");

  assert.ok(value !== null, "PROOF02_COMPUTED_DISPATCH should be present");
  assert.match(
    value,
    /^(resolved|unresolved|not-exercised)$/,
    `PROOF02_COMPUTED_DISPATCH value "${value}" is not in domain (resolved|unresolved|not-exercised)`,
  );
});

test("(b) PROOF02_DEPACKED_COMPUTED_DISPATCH values stay in domain (resolved|unresolved|not-exercised)", (t) => {
  const proof02_depacked = readFile(PROOF02_DEPACKED_PATH);
  const value = getOutcomeLineValue(proof02_depacked, "PROOF02_DEPACKED_COMPUTED_DISPATCH");

  // Note: PROOF02_DEPACKED_COMPUTED_DISPATCH may be absent if it's recorded in a different file (e.g., proof02-computed-dispatch.md).
  // If present, it must stay in domain.
  if (value !== null) {
    assert.match(
      value,
      /^(resolved|unresolved|not-exercised)$/,
      `PROOF02_DEPACKED_COMPUTED_DISPATCH value "${value}" is not in domain (resolved|unresolved|not-exercised)`,
    );
  }
});

test("(b) PROOF02_LOADER_COMPUTED_DISPATCH values stay in domain (resolved|unresolved|not-exercised)", (t) => {
  const proof02_loader = readFile(PROOF02_LOADER_PATH);
  const value = getOutcomeLineValue(proof02_loader, "PROOF02_LOADER_COMPUTED_DISPATCH");

  assert.ok(value !== null, "PROOF02_LOADER_COMPUTED_DISPATCH should be present");
  assert.match(
    value,
    /^(resolved|unresolved|not-exercised)$/,
    `PROOF02_LOADER_COMPUTED_DISPATCH value "${value}" is not in domain (resolved|unresolved|not-exercised)`,
  );
});

// =============================================================================
// Behavior (c): PROOF01_FALSE_POSITIVES is the refusal string, never a bare integer
// =============================================================================

test("(c) PROOF01_FALSE_POSITIVES is the structurally-uncomputable refusal, not a bare integer", (t) => {
  const proof01 = readFile(PROOF01_PATH);
  const value = getOutcomeLineValue(proof01, "PROOF01_FALSE_POSITIVES");

  assert.ok(value !== null, "PROOF01_FALSE_POSITIVES should be present");
  assert.match(
    value,
    /^structurally-uncomputable/,
    `PROOF01_FALSE_POSITIVES should start with "structurally-uncomputable", got: "${value}"`,
  );

  // Ensure it's not a bare integer
  const bareIntPattern = /^\d+$/;
  assert.ok(!bareIntPattern.test(value), `PROOF01_FALSE_POSITIVES should not be a bare integer, got: "${value}"`);
});

// =============================================================================
// Behavior (d): PROOF01_DATA_RECOVERY_PCT sits beside FIXTURE_* keys
// =============================================================================

test("(d) PROOF01_DATA_RECOVERY_PCT and FIXTURE_DATA_RECOVERY_PCT are in the same file (beside, not instead-of)", (t) => {
  const proof01 = readFile(PROOF01_PATH);

  const proof01Data = getOutcomeLineValue(proof01, "PROOF01_DATA_RECOVERY_PCT");
  const fixtureData = getOutcomeLineValue(proof01, "FIXTURE_DATA_RECOVERY_PCT");

  assert.ok(proof01Data !== null, "PROOF01_DATA_RECOVERY_PCT should be present");
  assert.ok(fixtureData !== null, "FIXTURE_DATA_RECOVERY_PCT should be present (beside PROOF01_*, not instead-of)");
});

test("(d) FIXTURE_FALSE_POSITIVES and FIXTURE_REPRODUCED are in proof01-dxa-real-release.md", (t) => {
  const proof01 = readFile(PROOF01_PATH);

  const fixtureFP = getOutcomeLineValue(proof01, "FIXTURE_FALSE_POSITIVES");
  const fixtureReproduced = getOutcomeLineValue(proof01, "FIXTURE_REPRODUCED");

  assert.ok(fixtureFP !== null, "FIXTURE_FALSE_POSITIVES should be present");
  assert.ok(fixtureReproduced !== null, "FIXTURE_REPRODUCED should be present");
});

// =============================================================================
// Behavior (e): README.md has exactly one TEST_AUTOMATED_BASELINE line
// =============================================================================

test("(e) README.md has exactly one TEST_AUTOMATED_BASELINE line", (t) => {
  const readme = readFile(README_PATH);

  // Match lines that start with "TEST_AUTOMATED_BASELINE:" at column 0
  const lineMatches = [];
  const lines = readme.split("\n");
  for (const line of lines) {
    if (line.match(/^TEST_AUTOMATED_BASELINE: /)) {
      lineMatches.push(line);
    }
  }

  assert.equal(lineMatches.length, 1, `README.md should have exactly one TEST_AUTOMATED_BASELINE line, found ${lineMatches.length}`);

  // Also verify the line shape: "tests N / pass N / fail N"
  const value = lineMatches[0].replace(/^TEST_AUTOMATED_BASELINE: /, "");
  assert.match(
    value,
    /^tests \d+ \/ pass \d+ \/ fail \d+$/,
    `TEST_AUTOMATED_BASELINE value "${value}" does not match expected shape "tests N / pass N / fail N"`,
  );
});

// =============================================================================
// Behavior (f): Document-ordering property (site enumeration before Ghidra,
//               derivation rule before verdict)
// =============================================================================

test("(f) proof02-loader-stage.md: PROOF02_LOADER_SITES_ENUMERATED precedes first Ghidra RUN step", (t) => {
  const proof02 = readFile(PROOF02_LOADER_PATH);

  // Find position of PROOF02_LOADER_SITES_ENUMERATED outcome line (the numeric count)
  const siteEnumPos = proof02.indexOf("PROOF02_LOADER_SITES_ENUMERATED:");
  // Find position of the actual Ghidra run section (## Step 2 or similar procedural marker)
  const ghidraRunPos = proof02.indexOf("## Step 2");

  assert.ok(siteEnumPos !== -1, "PROOF02_LOADER_SITES_ENUMERATED outcome line should be present");
  assert.ok(ghidraRunPos !== -1, "A 'Step 2' procedural section describing Ghidra run should be present");
  assert.ok(
    siteEnumPos < ghidraRunPos,
    `Site enumeration outcome line should precede the Ghidra RUN section (D-06 circularity guard)`,
  );
});

test("(f) proof02-computed-dispatch.md: derivation rule precedes PROOF02_COMPUTED_DISPATCH value", (t) => {
  const proof02 = readFile(PROOF02_DISPATCH_PATH);

  // Find position of the derivation rule (the prose describing "resolved", "unresolved", "not-exercised")
  // This is typically around "Step 1" where it says "resolved -- at least one..."
  const rulePos = proof02.indexOf("resolved --");
  // Find position of the actual verdict line
  const verdictPos = proof02.indexOf("PROOF02_COMPUTED_DISPATCH:");

  assert.ok(rulePos !== -1, "Derivation rule should be present (mentioning resolved/unresolved/not-exercised)");
  assert.ok(verdictPos !== -1, "PROOF02_COMPUTED_DISPATCH verdict line should be present");
  assert.ok(rulePos < verdictPos, `Derivation rule should precede the PROOF02_COMPUTED_DISPATCH value line (D-06 guard)`);
});
