// tool-support-table.test.mjs
//
// WHY THIS FILE IS .mjs, NOT .ts (deliberate, recorded deviation from
// 08-VALIDATION.md's naming): a .ts test importing a repo-root .mjs fails
// `tsc --noEmit` with TS7016 ("Could not find a declaration file"), because
// this package's tsconfig.json sets `allowJs: false` and `include` covers
// only **/*.ts and **/*.mts (verified empirically this session). A .mjs test
// is never typechecked, still matches package.json's `node --test '*.test.*'`
// glob, and still matches test-gate.mjs's `/\.test\.[a-zA-Z0-9]+$/`
// automated-set regex -- so it lands in the automated gate with no edit to
// MANUAL_ONLY_TESTS and no typecheck error.
//
// This is the byte-identity drift guard for docs/tool-support.md (T-08-03-01)
// PLUS the structural proof that the table's row set is not hand-typed
// (T-08-03-02, T-08-03-03): the derived-union equality test below computes
// its own expected row set independently from the same three inputs the
// generator uses, using the test's own code -- never by importing the
// generator's discoverSyntheticToolNames() -- so a bug shared between
// generator and test cannot pass silently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateToolSupportTable } from "../../../scripts/generate-tool-support-table.mjs";
import { DENY_LIST } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(dirname(HERE)));
const DOC_PATH = join(ROOT, "docs/tool-support.md");
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");
const STOCK_MANIFEST_PATH = join(HERE, "tools-manifest.stock.json");
const PROXY_SOURCE_PATH = join(HERE, "vice-proxy.ts");

/** Extracts every `| toolname | ... |` row's first-cell tool name from a
 * generated document string, in document order. Used only by tests below --
 * never by the generator itself. */
function extractRowNames(doc) {
  const names = [];
  for (const line of doc.split("\n")) {
    const m = line.match(/^\|\s*(vice_[a-z0-9_]+)\s*\|/);
    if (m) names.push(m[1]);
  }
  return names;
}

/**
 * Independent re-derivation of the two-hop synthetic-tool discovery
 * (research Pitfall 2), written by this test's own code rather than imported
 * from the generator -- so a shared bug between generator and test cannot
 * pass silently. Deliberately a separate implementation from
 * generate-tool-support-table.mjs's discoverSyntheticToolNames().
 */
function independentlyDiscoverSyntheticNames(proxySource) {
  const REGISTRATION_RE = /tools\[(\w+)\.name\]\s*=/g;
  const LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+manifestTools\s*\)/;
  const loopVarMatch = proxySource.match(LOOP_VAR_RE);
  const loopVar = loopVarMatch ? loopVarMatch[1] : null;
  // Plan 11-05: a SECOND loop registration, structurally identical in shape
  // but not a VICE capability at all (D-16/Rule A18 -- regenerator2000 never
  // touches VICE, so it has no fork-vs-stock row to contribute here).
  // Excluded the same structural way the manifest loop's own `def` already
  // is, never resolved as a single-const synthetic tool.
  const R2000_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+R2000_TOOL_DEFINITIONS\s*\)/;
  const r2000LoopVarMatch = proxySource.match(R2000_LOOP_VAR_RE);
  const r2000LoopVar = r2000LoopVarMatch ? r2000LoopVarMatch[1] : null;

  const seen = new Set();
  const names = new Set();
  let match;
  while ((match = REGISTRATION_RE.exec(proxySource)) !== null) {
    const ident = match[1];
    if (seen.has(ident)) continue;
    seen.add(ident);
    if (ident === loopVar) continue;
    if (ident === r2000LoopVar) continue;
    const declRe = new RegExp(`const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{[\\s\\S]*?name:\\s*"([^"]+)"`);
    const declMatch = proxySource.match(declRe);
    assert.ok(declMatch, `independentlyDiscoverSyntheticNames: could not resolve "${ident}" to a literal name`);
    names.add(declMatch[1]);
  }
  return names;
}

/** Reads a manifest, structurally clones and edits its parsed object via
 * `mutate`, and writes it into a fresh mkdtempSync scratch file -- so every
 * fixture in this file is schema-true by construction rather than
 * hand-typed JSON that could drift from the real shape. Returns the scratch
 * file's path; caller is responsible for cleanup of the containing dir. */
function writeMutatedManifestFixture(scratchDir, sourcePath, fixtureName, mutate) {
  const parsed = JSON.parse(readFileSync(sourcePath, "utf8"));
  mutate(parsed);
  const outPath = join(scratchDir, fixtureName);
  writeFileSync(outPath, JSON.stringify(parsed));
  return outPath;
}

// ---------------------------------------------------------------------------

test("generateToolSupportTable() output is byte-identical to committed docs/tool-support.md", () => {
  const generated = generateToolSupportTable();
  const committed = readFileSync(DOC_PATH, "utf8");
  assert.equal(
    generated,
    committed,
    "docs/tool-support.md is STALE -- run `node scripts/generate-tool-support-table.mjs` and commit the result.",
  );
});

test("generateToolSupportTable() is deterministic across consecutive calls", () => {
  const first = generateToolSupportTable();
  const second = generateToolSupportTable();
  assert.equal(first, second, "two consecutive calls produced different output -- embedded run state (timestamp/path/hostname) leaked in");
});

test("non-vacuity: the real generated document has more than 50 tool rows", () => {
  const generated = generateToolSupportTable();
  const rowCount = extractRowNames(generated).length;
  assert.ok(
    rowCount > 50,
    `expected more than 50 tool rows in the real generated document, got ${rowCount} -- the manifest read or row extraction is broken`,
  );
});

test("a fixture manifest pair with a reduced tool list produces strictly fewer rows than the real manifests", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "tool-support-table-"));
  try {
    const realDoc = generateToolSupportTable();
    const realRowCount = extractRowNames(realDoc).length;

    // Reduce BOTH manifests to the same small SHARED subset of tool names
    // (present in both today), so the fixture introduces no new divergence
    // and needs no registry entry -- a structural edit of the real, parsed
    // shape, never hand-typed JSON.
    const forkManifest = JSON.parse(readFileSync(FORK_MANIFEST_PATH, "utf8"));
    const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST_PATH, "utf8"));
    const forkNameSet = new Set(forkManifest.tools.map((t) => t.name));
    const stockNameSet = new Set(stockManifest.tools.map((t) => t.name));
    const sharedNames = [...forkNameSet].filter((n) => stockNameSet.has(n)).sort().slice(0, 3);
    assert.equal(sharedNames.length, 3, "precondition failed: expected at least 3 shared tool names in the real manifests");

    const reducedForkPath = writeMutatedManifestFixture(scratchDir, FORK_MANIFEST_PATH, "fork-reduced.json", (m) => {
      m.tools = m.tools.filter((t) => sharedNames.includes(t.name));
    });
    const reducedStockPath = writeMutatedManifestFixture(scratchDir, STOCK_MANIFEST_PATH, "stock-reduced.json", (m) => {
      m.tools = m.tools.filter((t) => sharedNames.includes(t.name));
    });

    const reducedDoc = generateToolSupportTable({
      forkManifestPath: reducedForkPath,
      stockManifestPath: reducedStockPath,
    });
    const reducedRowCount = extractRowNames(reducedDoc).length;

    assert.ok(
      reducedRowCount < realRowCount,
      `expected the reduced-manifest fixture to produce fewer rows than the real manifests ` +
        `(real=${realRowCount}, reduced=${reducedRowCount}) -- the row count must follow the manifests, not be hand-typed`,
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});

test("a fixture stock manifest that ADDS a currently fork-only name moves that row's stock cell to available", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "tool-support-table-"));
  try {
    // vice_backtrace is fork-only (descoped, registered) in the real
    // manifests today -- verified by this test's own before-assertion, not
    // assumed.
    const FORK_ONLY_TARGET = "vice_backtrace";
    const realDoc = generateToolSupportTable();
    const realForkManifest = JSON.parse(readFileSync(FORK_MANIFEST_PATH, "utf8"));
    const realStockManifest = JSON.parse(readFileSync(STOCK_MANIFEST_PATH, "utf8"));
    assert.ok(
      realForkManifest.tools.some((t) => t.name === FORK_ONLY_TARGET),
      `precondition failed: ${FORK_ONLY_TARGET} must be present in the real fork manifest`,
    );
    assert.ok(
      !realStockManifest.tools.some((t) => t.name === FORK_ONLY_TARGET),
      `precondition failed: ${FORK_ONLY_TARGET} must be ABSENT from the real stock manifest today`,
    );
    const realTargetRow = realDoc.split("\n").find((l) => l.startsWith(`| ${FORK_ONLY_TARGET} |`));
    assert.ok(realTargetRow, `precondition failed: no row found for ${FORK_ONLY_TARGET} in the real document`);
    assert.ok(realTargetRow.includes("—"), `precondition failed: ${FORK_ONLY_TARGET}'s stock cell must start unavailable`);

    const addedStockPath = writeMutatedManifestFixture(scratchDir, STOCK_MANIFEST_PATH, "stock-added.json", (m) => {
      const forkTool = realForkManifest.tools.find((t) => t.name === FORK_ONLY_TARGET);
      m.tools.push(forkTool);
    });

    const mutatedDoc = generateToolSupportTable({ stockManifestPath: addedStockPath });
    const mutatedTargetRow = mutatedDoc.split("\n").find((l) => l.startsWith(`| ${FORK_ONLY_TARGET} |`));
    assert.ok(mutatedTargetRow, `${FORK_ONLY_TARGET}'s row disappeared after being added to the stock manifest`);
    assert.match(
      mutatedTargetRow,
      /^\| vice_backtrace \| ✅ \| ✅ \|/,
      `expected ${FORK_ONLY_TARGET}'s row to show BOTH backends available after the stock manifest add, got: ${mutatedTargetRow}`,
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});

test("derived-union equality: the generated document's row set equals an independently-computed union of the three inputs", () => {
  const forkManifest = JSON.parse(readFileSync(FORK_MANIFEST_PATH, "utf8"));
  const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST_PATH, "utf8"));
  const proxySource = readFileSync(PROXY_SOURCE_PATH, "utf8");

  const forkNames = new Set(forkManifest.tools.map((t) => t.name));
  const stockNames = new Set(stockManifest.tools.map((t) => t.name));
  for (const denied of DENY_LIST) {
    forkNames.delete(denied);
    stockNames.delete(denied);
  }
  const syntheticNames = independentlyDiscoverSyntheticNames(proxySource);
  const expectedUnion = new Set([...forkNames, ...stockNames, ...syntheticNames]);

  const generated = generateToolSupportTable();
  const actualRowNames = extractRowNames(generated);

  const expectedSorted = [...expectedUnion].sort();
  const actualSorted = [...actualRowNames].sort();

  const inActualNotExpected = actualSorted.filter((n) => !expectedUnion.has(n));
  const inExpectedNotActual = expectedSorted.filter((n) => !actualRowNames.includes(n));

  assert.deepEqual(
    inActualNotExpected,
    [],
    `generator invented ${inActualNotExpected.length} row(s) not in the independently-computed union: ${JSON.stringify(inActualNotExpected)}`,
  );
  assert.deepEqual(
    inExpectedNotActual,
    [],
    `table is INCOMPLETE -- ${inExpectedNotActual.length} union member(s) have no row: ${JSON.stringify(inExpectedNotActual)}`,
  );
  assert.deepEqual(actualSorted, expectedSorted, "row name set does not equal the independently-computed union");
  assert.equal(actualRowNames.length, expectedUnion.size, "row count does not equal the independently-computed union size");
});
