// node:test coverage of stock-symbols.ts -- handleSymbolsLoad,
// handleSymbolsLookup, and the zero-code-change integration proof that
// stock-address.ts's parseAddress()/symbolNameFor()/hasSymbolStore() all
// change behaviour after a load with no edit to any other module. Every
// "workspace" below is a real mkdtempSync() directory pointed at via
// CLAUDE_PROJECT_DIR (repoRoot()'s branch 0), copied from
// stock-dispatch.test.ts's own withTempRepoRootForConformance() shape --
// never a write into this worktree itself.
import { test, afterEach, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleSymbolsLoad, handleSymbolsLookup, resetSymbolStoreForTest } from "./stock-symbols.ts";
import { parseAddress, symbolNameFor, hasSymbolStore, setSymbolResolver } from "./stock-address.ts";
import { checkAgainstSchema } from "./stock-schema-check.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

const DEPS = {} as unknown as StockDispatchDeps;

/** The shipped manifest's own declared `outputSchema` for `vice_symbols_lookup`
 * -- read directly with node:fs (relative to this test file, matching the
 * plan's instruction) rather than duplicating the schema by hand, so this
 * assertion tracks the real, committed contract rather than a copy of it. */
function symbolsLookupOutputSchema(): unknown {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "tools-manifest.stock.json"), "utf8")) as {
    tools: { name: string; outputSchema: unknown }[];
  };
  const entry = manifest.tools.find((t) => t.name === "vice_symbols_lookup");
  assert.ok(entry, "tools-manifest.stock.json must declare vice_symbols_lookup");
  return entry!.outputSchema;
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

/** Copied from stock-dispatch.test.ts's own withTempRepoRootForConformance()
 * shape: mkdtempSync() + a CLAUDE_PROJECT_DIR swap so repoRoot() (branch 0)
 * resolves to a scratch directory, restored and removed afterwards. Never
 * writes into this worktree. */
function withTempWorkspace(fn: (dir: string, t: TestContext) => Promise<void> | void) {
  return async (t: TestContext) => {
    const dir = mkdtempSync(join(tmpdir(), "vice-symbols-test-"));
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = dir;
    try {
      await fn(dir, t);
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

afterEach(() => {
  resetSymbolStoreForTest();
});

// The exact confirmed VICE label-file shape (acme-build/SKILL.md's
// --vicelabels example), deliberately including: two normal entries, one
// uppercase-hex entry, one blank line, one comment-ish non-matching line,
// one unrelated monitor command, one duplicate name, and one second name
// for an already-mapped address.
const FIXTURE = [
  "al C:0810 .main",
  "al C:d020 .vic_cborder",
  "al C:FFD2 .chrout",
  "",
  "; this is not a label",
  "break $0810",
  "al C:0900 .main",
  "al C:0810 .entry",
].join("\n");

// ---------------------------------------------------------------------------
// Parsing and answer shape
// ---------------------------------------------------------------------------

test(
  "vice_symbols_load: parses the fixture with the exact expected counts and runState",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const result = await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    assert.equal(result.isError, false);
    const payload = parseAnswer(result);
    assert.equal(payload.format, "vice");
    assert.equal(payload.symbolCount, 4);
    assert.equal(payload.duplicateNames, 1);
    assert.equal(payload.skippedLines, 3);
    assert.equal(payload.runState, "unknown");
  }),
);

test(
  "vice_symbols_lookup: uppercase hex parses -- 0xffd2 resolves to chrout after a load",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    const result = await handleSymbolsLookup({ address: 0xffd2 }, DEPS);
    const payload = parseAnswer(result);
    assert.equal(payload.found, true);
    assert.equal(payload.name, "chrout");
  }),
);

test(
  "vice_symbols_lookup: last definition wins by name -- main resolves to 0x0900, not 0x0810",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    const result = await handleSymbolsLookup({ name: "main" }, DEPS);
    const payload = parseAnswer(result);
    assert.equal(payload.found, true);
    assert.equal(payload.address, 0x0900);
  }),
);

test(
  "vice_symbols_lookup: first name wins by address -- 0x0810 resolves to main, not entry",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    const result = await handleSymbolsLookup({ address: 0x0810 }, DEPS);
    const payload = parseAnswer(result);
    assert.equal(payload.found, true);
    assert.equal(payload.name, "main");
  }),
);

test(
  "vice_symbols_load: a file with no matching lines loads successfully with symbolCount 0 and a diagnostic note",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "empty.lbl"), "break $1000\n; nothing here\n");
    const result = await handleSymbolsLoad({ path: "empty.lbl" }, DEPS);
    assert.equal(result.isError, false);
    const payload = parseAnswer(result);
    assert.equal(payload.symbolCount, 0);
    assert.match(String(payload.note), /al C:/);
    assert.match(String(payload.note), /not an error/);
  }),
);

test(
  "vice_symbols_load: a second load replaces rather than merges",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const first = await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    assert.equal(parseAnswer(first).replaced, false);

    writeFileSync(join(dir, "alpha.lbl"), "al C:2000 .alpha");
    const second = await handleSymbolsLoad({ path: "alpha.lbl" }, DEPS);
    assert.equal(parseAnswer(second).replaced, true);

    const lookup = await handleSymbolsLookup({ name: "main" }, DEPS);
    assert.equal(parseAnswer(lookup).found, false);
  }),
);

// ---------------------------------------------------------------------------
// Path containment (T-05-02-01/02)
// ---------------------------------------------------------------------------

test(
  "vice_symbols_load: a relative path inside the temp workspace loads",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const result = await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    assert.equal(result.isError, false);
  }),
);

test(
  "vice_symbols_load: '../outside.lbl' is refused, naming the workspace root",
  withTempWorkspace(async (dir) => {
    const result = await handleSymbolsLoad({ path: "../outside.lbl" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /workspace/);
    assert.match(result.content[0]!.text, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }),
);

test(
  "vice_symbols_load: an absolute path outside the workspace is refused",
  withTempWorkspace(async () => {
    const result = await handleSymbolsLoad({ path: "/etc/hostname" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /workspace/);
  }),
);

test(
  "vice_symbols_load: a symlink inside the workspace pointing outside it is refused, naming the resolved target and installing no table",
  withTempWorkspace(async (dir, t) => {
    const outsideTarget = join(tmpdir(), `vice-symbols-outside-${process.pid}-${Date.now()}.lbl`);
    writeFileSync(outsideTarget, "al C:1234 .outside");
    const linkPath = join(dir, "link.lbl");
    try {
      symlinkSync(outsideTarget, linkPath);
    } catch (err) {
      t.skip(`symlinkSync unavailable in this environment: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      const result = await handleSymbolsLoad({ path: "link.lbl" }, DEPS);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text.toLowerCase(), /workspace/);
      // WR-08: the refusal must name the resolved (realpath) target, not
      // just say "outside the workspace" with no evidence of what was
      // actually resolved.
      assert.match(result.content[0]!.text, new RegExp(realpathSync(outsideTarget).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

      // A refused load must never install a symbol table -- a following
      // lookup still reports the pre-existing (empty) state.
      const lookup = await handleSymbolsLookup({ name: "outside" }, DEPS);
      const payload = parseAnswer(lookup);
      assert.equal(payload.found, false);
      assert.match(String(payload.note), /no symbol table is loaded/);
    } finally {
      rmSync(outsideTarget, { force: true });
    }
  }),
);

test(
  "vice_symbols_load: loading through an in-workspace symlink returns resolvedPath as the realpath of the target, not the symlink path",
  withTempWorkspace(async (dir, t) => {
    const realSubdir = join(dir, "real-subdir");
    mkdirSync(realSubdir);
    const targetPath = join(realSubdir, "actual-labels.lbl");
    writeFileSync(targetPath, FIXTURE);
    const linkPath = join(dir, "via-link.lbl");
    try {
      symlinkSync(targetPath, linkPath);
    } catch (err) {
      t.skip(`symlinkSync unavailable in this environment: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const result = await handleSymbolsLoad({ path: "via-link.lbl" }, DEPS);
    assert.equal(result.isError, false);
    const payload = parseAnswer(result);
    assert.equal(payload.resolvedPath, realpathSync(targetPath));
    assert.equal(payload.symbolCount, 4);
    // Regression guard: resolvedPath must never contain the symlink's own
    // basename when it differs from the target's basename -- this fails if
    // resolveLabelFilePath() ever again returns `resolved` instead of `real`.
    assert.ok(
      !String(payload.resolvedPath).includes("via-link.lbl"),
      `resolvedPath must report the target's realpath, not the symlink path: ${payload.resolvedPath}`,
    );
  }),
);

test(
  "vice_symbols_load: a non-existent path is refused with a 'not found' message, distinct from the escape refusal",
  withTempWorkspace(async () => {
    const result = await handleSymbolsLoad({ path: "does-not-exist.lbl" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /not found/);
  }),
);

test(
  "vice_symbols_load: a directory path is refused rather than throwing",
  withTempWorkspace(async (dir) => {
    mkdirSync(join(dir, "adir"));
    const result = await handleSymbolsLoad({ path: "adir" }, DEPS);
    assert.equal(result.isError, true);
  }),
);

// ---------------------------------------------------------------------------
// Resource ceilings (T-05-02-03)
// ---------------------------------------------------------------------------

test(
  "vice_symbols_load: a file above MAX_LABEL_FILE_BYTES is refused",
  withTempWorkspace(async (dir) => {
    const bytes = 2 * 1024 * 1024 + 1;
    writeFileSync(join(dir, "huge.lbl"), "#".repeat(bytes));
    const result = await handleSymbolsLoad({ path: "huge.lbl" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /2097152/);
  }),
);

test(
  "vice_symbols_load: a file with more than MAX_LABEL_FILE_LINES lines is refused, naming the ceiling",
  withTempWorkspace(async (dir) => {
    const text = new Array(50001).fill("").join("\n");
    writeFileSync(join(dir, "manylines.lbl"), text);
    const result = await handleSymbolsLoad({ path: "manylines.lbl" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /50000/);
  }),
);

test(
  "vice_symbols_load: a file defining more than MAX_SYMBOLS distinct names is refused, naming the ceiling",
  withTempWorkspace(async (dir) => {
    const lines: string[] = [];
    for (let i = 0; i < 20001; i += 1) {
      lines.push(`al C:0000 .sym${i}`);
    }
    writeFileSync(join(dir, "manysymbols.lbl"), lines.join("\n"));
    const result = await handleSymbolsLoad({ path: "manysymbols.lbl" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /20000/);
  }),
);

// ---------------------------------------------------------------------------
// format refusals (D-05-02)
// ---------------------------------------------------------------------------

test(
  "vice_symbols_load: format 'kickasm' is refused, naming kickasm and 'al C:'",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const result = await handleSymbolsLoad({ path: "labels.lbl", format: "kickasm" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /kickasm/);
    assert.match(result.content[0]!.text, /al C:/);
  }),
);

test(
  "vice_symbols_load: format 'simple' is refused, naming simple and 'al C:'",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const result = await handleSymbolsLoad({ path: "labels.lbl", format: "simple" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /simple/);
    assert.match(result.content[0]!.text, /al C:/);
  }),
);

test(
  "vice_symbols_load: an unknown format is refused, listing the accepted values",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const result = await handleSymbolsLoad({ path: "labels.lbl", format: "bogus" }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /auto/);
    assert.match(result.content[0]!.text, /vice/);
  }),
);

test(
  "vice_symbols_load: format 'vice' and 'auto' both succeed on the same fixture with identical symbolCount",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const viceResult = await handleSymbolsLoad({ path: "labels.lbl", format: "vice" }, DEPS);
    const autoResult = await handleSymbolsLoad({ path: "labels.lbl", format: "auto" }, DEPS);
    assert.equal(viceResult.isError, false);
    assert.equal(autoResult.isError, false);
    assert.equal(parseAnswer(viceResult).symbolCount, parseAnswer(autoResult).symbolCount);
  }),
);

// ---------------------------------------------------------------------------
// vice_symbols_lookup
// ---------------------------------------------------------------------------

test(
  "vice_symbols_lookup: with no table loaded, found is false with a 'no symbol table is loaded' note",
  withTempWorkspace(async () => {
    const result = await handleSymbolsLookup({ name: "main" }, DEPS);
    assert.equal(result.isError, false);
    const payload = parseAnswer(result);
    assert.equal(payload.found, false);
    assert.match(String(payload.note), /no symbol table is loaded/);
  }),
);

test(
  "vice_symbols_lookup: an unknown name and an unknown address each return found:false with isError:false",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);

    const byName = await handleSymbolsLookup({ name: "nonexistent" }, DEPS);
    assert.equal(byName.isError, false);
    assert.equal(parseAnswer(byName).found, false);

    const byAddress = await handleSymbolsLookup({ address: 0x1234 }, DEPS);
    assert.equal(byAddress.isError, false);
    assert.equal(parseAnswer(byAddress).found, false);
  }),
);

test(
  "vice_symbols_lookup: address accepts a number, a '$hex' string and a '0x' string for the same address",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);

    const byNumber = await handleSymbolsLookup({ address: 0xd020 }, DEPS);
    const byDollarHex = await handleSymbolsLookup({ address: "$d020" }, DEPS);
    const byZeroX = await handleSymbolsLookup({ address: "0xd020" }, DEPS);

    assert.equal(parseAnswer(byNumber).found, true);
    assert.equal(parseAnswer(byDollarHex).found, true);
    assert.equal(parseAnswer(byZeroX).found, true);
    assert.equal(parseAnswer(byNumber).name, "vic_cborder");
    assert.equal(parseAnswer(byDollarHex).name, "vic_cborder");
    assert.equal(parseAnswer(byZeroX).name, "vic_cborder");
  }),
);

// ---------------------------------------------------------------------------
// WR-01: query.address echoes the PARSED number for every accepted form,
// never the caller's raw argument -- and the address branch is schema-
// checked against the shipped manifest so it cannot pass vacuously.
// ---------------------------------------------------------------------------

test(
  "vice_symbols_lookup: query.address is the parsed number 53280 for every accepted address form",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);

    for (const form of [53280, "$d020", "0xd020"]) {
      const result = await handleSymbolsLookup({ address: form }, DEPS);
      const payload = parseAnswer(result);
      const query = payload.query as Record<string, unknown>;
      assert.equal(typeof query.address, "number", `form ${JSON.stringify(form)}: query.address must be a number`);
      assert.equal(query.address, 53280, `form ${JSON.stringify(form)}: query.address must be 53280`);
      assert.equal(payload.found, true, `form ${JSON.stringify(form)}: address is defined in the fixture`);
    }
  }),
);

test(
  "vice_symbols_lookup: the address branch's real answer validates against the shipped manifest outputSchema",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    const schema = symbolsLookupOutputSchema();

    const addressResult = await handleSymbolsLookup({ address: "$d020" }, DEPS);
    const addressPayload = parseAnswer(addressResult);
    assert.deepEqual(checkAgainstSchema(addressPayload, schema), []);

    const nameResult = await handleSymbolsLookup({ name: "main" }, DEPS);
    const namePayload = parseAnswer(nameResult);
    assert.deepEqual(checkAgainstSchema(namePayload, schema), []);
    assert.equal(typeof namePayload.query, "object");
    assert.equal(typeof (namePayload.query as Record<string, unknown>).name, "string");
  }),
);

test(
  "vice_symbols_lookup: non-vacuity control -- forcing query.address back to a string DOES fail the schema check",
  withTempWorkspace(async (dir) => {
    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    const schema = symbolsLookupOutputSchema();

    const result = await handleSymbolsLookup({ address: "$d020" }, DEPS);
    const payload = parseAnswer(result);
    const corrupted = { ...payload, query: { address: "$d020" } };
    const violations = checkAgainstSchema(corrupted, schema);
    assert.notDeepEqual(violations, []);
    assert.ok(
      violations.some((v) => v.includes("query.address")),
      `expected a violation mentioning query.address, got: ${JSON.stringify(violations)}`,
    );
  }),
);

test(
  "vice_symbols_lookup: neither name nor address supplied is refused, stating exactly one is required",
  withTempWorkspace(async () => {
    const result = await handleSymbolsLookup({}, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /exactly one/);
  }),
);

test(
  "vice_symbols_lookup: both name and address supplied is refused, stating they are mutually exclusive",
  withTempWorkspace(async () => {
    const result = await handleSymbolsLookup({ name: "main", address: 0x0810 }, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /mutually exclusive/);
  }),
);

// ---------------------------------------------------------------------------
// The zero-code-change integration proof (DERIV-04's whole point)
// ---------------------------------------------------------------------------

test(
  "integration: parseAddress()/symbolNameFor()/hasSymbolStore() all change behaviour after a load, with no edit to any other module",
  withTempWorkspace(async (dir) => {
    // Ensure a clean holder before this test's own assertions -- afterEach()
    // from an earlier failing test could otherwise leak state.
    setSymbolResolver(null);

    assert.throws(() => parseAddress("vic_cborder"), /no symbol table is loaded/);

    writeFileSync(join(dir, "labels.lbl"), FIXTURE);
    const loadResult = await handleSymbolsLoad({ path: "labels.lbl" }, DEPS);
    assert.equal(loadResult.isError, false);

    assert.equal(parseAddress("vic_cborder"), 0xd020);
    assert.equal(symbolNameFor(0xd020), "vic_cborder");
    assert.equal(hasSymbolStore(), true);

    resetSymbolStoreForTest();
    assert.equal(hasSymbolStore(), false);
  }),
);
