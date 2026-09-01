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
//
// THE ONE EXCEPTION, AND WHY IT IS NOT A HOLE (plan 29-01). The negative and
// positive controls at the END of this file DO import
// discoverSyntheticToolNames, because their subject is that function's own
// WR-08 bounding behaviour -- "an unresolvable identifier throws by name, and
// the generator can never emit a DIFFERENT table" -- which cannot be observed
// through a re-implementation. Those tests never touch
// independentlyDiscoverSyntheticNames() and never feed the equality test, so
// the independence above holds exactly as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// `discoverSyntheticToolNames` is imported ONLY for the negative-control and
// identity tests at the end of this file, which are about the GENERATOR'S OWN
// bounding behaviour and therefore have to call the real thing. It is never
// reached from `independentlyDiscoverSyntheticNames()` or from the
// derived-union equality test, so the independence property this file's header
// declares is untouched: the equality test still computes its expected row set
// with its own code, and a bug shared between generator and test still cannot
// pass silently there.
import { discoverSyntheticToolNames, generateToolSupportTable } from "../../../scripts/generate-tool-support-table.mjs";
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
  // A SECOND loop registration, structurally identical in shape but not a
  // VICE capability at all (D-16/Rule A18 -- the anno_* family reaches a
  // proxy-local SQLite annotation store and never touches VICE, so it has no
  // fork-vs-stock row to contribute here). Excluded the same structural way
  // the manifest loop's own `def` already is, never resolved as a
  // single-const synthetic tool.
  const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;
  const annoLoopVarMatch = proxySource.match(ANNO_LOOP_VAR_RE);
  const annoLoopVar = annoLoopVarMatch ? annoLoopVarMatch[1] : null;

  const seen = new Set();
  const names = new Set();
  let match;
  while ((match = REGISTRATION_RE.exec(proxySource)) !== null) {
    const ident = match[1];
    if (seen.has(ident)) continue;
    seen.add(ident);
    if (ident === loopVar) continue;
    if (ident === annoLoopVar) continue;

    // WR-08: bound the search to THIS declaration's own body via brace-depth
    // counting -- deliberately a DIFFERENT bounding technique from the
    // generator's "stop at the next top-level const/function/export" and
    // from capability-registry.test.ts's own bound, so a bug in one bounding
    // technique is caught by the other two independent witnesses. This is
    // load-bearing (see this file's header): do not collapse the three
    // scans into one shared helper.
    const openMatch = proxySource.match(new RegExp(`const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{`));
    assert.ok(openMatch, `independentlyDiscoverSyntheticNames: could not resolve "${ident}" to a declaration`);
    const braceOpenIndex = openMatch.index + openMatch[0].length - 1;
    let depth = 0;
    let braceCloseIndex = -1;
    for (let i = braceOpenIndex; i < proxySource.length; i++) {
      if (proxySource[i] === "{") depth++;
      else if (proxySource[i] === "}") {
        depth--;
        if (depth === 0) {
          braceCloseIndex = i;
          break;
        }
      }
    }
    assert.ok(braceCloseIndex !== -1, `independentlyDiscoverSyntheticNames: "${ident}"'s declaration body never closes`);
    const declBody = proxySource.slice(braceOpenIndex, braceCloseIndex + 1);
    const declMatch = declBody.match(/^\{\s*name:\s*"([^"]+)"/);
    assert.ok(
      declMatch,
      `independentlyDiscoverSyntheticNames: "${ident}"'s own declaration body has no name: field -- ` +
        "refusing to borrow a later declaration's name",
    );
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

test("every table row has exactly 4 cells -- no registry prose can split a row (WR-04)", () => {
  const generated = generateToolSupportTable();
  for (const line of generated.split("\n")) {
    if (!/^\|\s*vice_/.test(line)) continue;
    // Split on a pipe NOT preceded by the cell() helper's own backslash escape
    // (WR-04) -- an escaped `\|` inside a cell's prose is a literal character,
    // not a column boundary, and must not be counted as one.
    const parts = line.split(/(?<!\\)\|/);
    assert.equal(
      parts.length - 2,
      4,
      `row has the wrong cell count -- a registry reason/alternative string likely contains an ` +
        `unescaped pipe or newline: ${line}`,
    );
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

// ---------------------------------------------------------------------------
// MCP-03's recorded negative control (plan 29-01 Task 2).
//
// The claim MCP-03 makes is that substituting the anno_* family into the
// registration loop adds NO entry to either manifest and NO row to
// docs/tool-support.md. The byte-identity test above is the positive half of
// that claim, and on its own it is weak evidence: a table that regenerates
// identically because a witness was left pointing at a name that no longer
// exists would look exactly the same. WR-08's bounding property is what makes
// the positive half trustworthy -- the generator cannot emit a DIFFERENT
// table, only throw -- and this is the test that pins it.
//
// A synthetic proxy source is used rather than a mutated copy of the real one
// because the property under test is about the generator's reaction to an
// UNRESOLVABLE identifier, and a synthetic source states that situation in
// twelve readable lines instead of hiding it inside three thousand.
// ---------------------------------------------------------------------------

/** A minimal proxy source in the real file's shape: the manifest loop, one
 * genuine single-const synthetic tool, and a second loop registration whose
 * array name is supplied by the caller. */
function syntheticProxySource(annoArrayName) {
  return [
    'const DIAGNOSE_TOOL: ToolDefinition = {',
    '  name: "vice_diagnose",',
    '  description: "d",',
    '};',
    '',
    'for (const def of manifestTools) {',
    '  tools[def.name] = buildBackendAwareTool(def, (args) => forwardToVice(def.name, args));',
    '}',
    'tools[DIAGNOSE_TOOL.name] = buildBackendAwareTool(DIAGNOSE_TOOL, (args) => handleDiagnose(args));',
    `for (const annoDef of ${annoArrayName}) {`,
    '  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));',
    '}',
    '',
  ].join("\n");
}

test("negative control (MCP-03/WR-08): a loop-variable regex left un-re-pointed makes discoverSyntheticToolNames THROW by name -- it never emits a different table", () => {
  // The regex matches `ANNO_TOOL_DEFINITIONS`. Point the loop at anything else
  // and `annoDef` stops resolving as a loop variable, so the generator tries to
  // resolve it as a single-const synthetic tool, fails, and throws.
  const unmatched = syntheticProxySource("SOME_OTHER_TOOL_DEFINITIONS");
  assert.throws(
    () => discoverSyntheticToolNames(unmatched),
    (err) => {
      assert.match(err.message, /could not resolve synthetic tool registration identifier/);
      assert.match(err.message, /"annoDef"/, "the throw must NAME the unresolved identifier -- a generic failure would not say which witness was missed");
      assert.match(err.message, /fix the discovery regex explicitly rather than silently dropping the identifier/);
      return true;
    },
    "an unresolvable loop-variable identifier must throw, never be silently dropped from the row set",
  );
});

test("positive control (MCP-03): with the regex pointing at ANNO_TOOL_DEFINITIONS, the SAME synthetic source resolves cleanly and the anno loop contributes no row", () => {
  const matched = syntheticProxySource("ANNO_TOOL_DEFINITIONS");
  // Same source, one identifier changed: the only difference between throwing
  // and resolving is whether the witness was re-pointed. That is what makes
  // the negative control above a control rather than an assertion about a
  // malformed input.
  assert.deepEqual(discoverSyntheticToolNames(matched), ["vice_diagnose"]);
});

test("MCP-03 over the REAL proxy source: the synthetic set is still exactly the three proxy-local tools, and the anno_* family contributes none of them", () => {
  const proxySource = readFileSync(PROXY_SOURCE_PATH, "utf8");
  assert.match(proxySource, /for \(const annoDef of ANNO_TOOL_DEFINITIONS\)/, "non-vacuity: the anno loop must actually be present for its exclusion to mean anything");
  const names = discoverSyntheticToolNames(proxySource);
  assert.deepEqual([...names].sort(), ["vice_diagnose", "vice_recycle", "vice_result_continue"]);
  for (const name of names) {
    assert.ok(!name.startsWith("anno_"), `${name} is an anno_* name resolved as a synthetic proxy tool -- the family must be excluded structurally, by its loop variable`);
  }
});

test("MCP-03: the regenerated table matches the committed docs/tool-support.md in BYTE LENGTH as well as content", () => {
  const generated = generateToolSupportTable();
  const committed = readFileSync(DOC_PATH, "utf8");
  assert.equal(
    Buffer.byteLength(generated, "utf8"),
    Buffer.byteLength(committed, "utf8"),
    "byte length diverged -- the loop substitution was not identifier-only and must be investigated, never accepted by regenerating the committed file",
  );
  assert.equal(generated, committed);
});
