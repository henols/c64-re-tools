// node:test coverage of the CLOSED consumer set for host-path logic
// (CLAUDE.md: "Any host-facing path or hostname must go through hostpath.ts
// / containerpath.ts / container-guard.mts. The project maintains a tested
// closed consumer set for host-path logic.").
//
// GROUND TRUTH ESTABLISHED BY THIS PLAN (04-02): the two source comments
// that used to enforce this set by convention both pointed at
// `vice-mcp-selector-docs.test.mjs`'s "assertion 4" -- a file that does not
// exist anywhere in this repo (`find . -name 'vice-mcp-selector-docs*'`
// returns nothing) -- and both said "four production modules" while the
// real count was already FIVE (stock-paths.ts joined in Phase 3 and nobody
// updated them). This file is the first COMMITTED test of that set; before
// it, the set was enforced by comment convention only.
//
// Widening the five-member list below is a REVIEWED DECISION, not a
// mechanical fix for a failing test -- a new tool that genuinely needs
// host-path translation is rare (D-17's own table is exactly four tools,
// all long-lived emulator-side file operations) and each addition should be
// deliberate. A DERIVED module (anything registered in
// STOCK_DERIVED_TOOLS, stock-derived.ts) may NEVER be added to this list at
// all -- see stock-derived.ts's own header for why translating a
// client-side-derived path is exactly the bug DERIV-07's seam exists to
// prevent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { STOCK_DERIVED_TOOLS } from "./stock-derived.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Matches a real ES import statement naming hostpath.ts/.mts/.mjs, after
 * `//`-comment lines have already been stripped -- never a bare
 * `includes("hostpath")` and never a `grep -c` against raw file text. This
 * is mandatory grep-gate hygiene here: stock-paths.ts's own header mentions
 * "hostpath.ts", vice-broker-client.ts's header literally says "MUST NOT
 * import hostpath.ts", and load-order.test.ts embeds the import statement
 * as a string literal -- an unfiltered match against raw text would produce
 * a self-invalidating gate that "passes" by counting comments and string
 * literals as imports. */
const HOSTPATH_IMPORT_RE = /^\s*import\s[^;]*from\s+"\.\/hostpath\.(ts|mts|mjs)"/;

/** True iff any line of the (already comment-stripped) source is a real
 * import of hostpath.ts. Extracted into ONE named predicate -- both the real
 * consumer-set scan below and the planted-violation test call this same
 * function, so there is exactly one definition of "counts as an import"
 * (the 11-01 discipline: a structural test and its own proof must share the
 * checked logic, not each carry a copy). */
function importsHostpath(lines: string[]): boolean {
  return lines.some((line) => HOSTPATH_IMPORT_RE.test(line));
}

/** Strips full-line `//` comments before matching -- a line that is ENTIRELY
 * a comment (allowing leading whitespace) is dropped; a trailing `//`
 * comment on a real code line is left alone since no import statement in
 * this codebase carries one. */
function stripCommentLines(src: string): string[] {
  return src.split("\n").filter((line) => !/^\s*\/\//.test(line));
}

/** The complete top-level module list this repo ships: every `*.ts`/`*.mts`
 * directly under `.claude/mcp/vice`, excluding `*.test.*` files. Does NOT
 * walk into `resources/` (compiled `.mjs` artifacts, not source) or
 * `node_modules/`. */
function topLevelProductionModules(): string[] {
  return readdirSync(HERE)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

/** The set of production modules whose stripped source contains a real
 * import of hostpath.ts/.mts/.mjs. */
function hostpathImporters(): string[] {
  const importers: string[] = [];
  for (const name of topLevelProductionModules()) {
    const src = readFileSync(join(HERE, name), "utf8");
    const lines = stripCommentLines(src);
    if (importsHostpath(lines)) {
      importers.push(name);
    }
  }
  return importers.sort();
}

const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
});

test("stock-derived.ts is absent from the hostpath.ts consumer set", () => {
  assert.equal(hostpathImporters().includes("stock-derived.ts"), false);
});

test("the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set", () => {
  const importers = hostpathImporters();
  for (const name of [
    "stock-disassemble.ts",
    "disasm-opcodes.ts",
    "disasm-decoder.ts",
    "disasm-renderer.ts",
    "stock-memory-search.ts",
    "stock-symbols.ts",
    "stock-vicii.ts",
    "stock-cia.ts",
    "stock-sprites.ts",
  ]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

/** The r2000 production module family, derived from disk rather than typed
 * (INT-01/D-11.1-03): every `r2000-*.ts` file `topLevelProductionModules()`
 * already excludes `*.test.*` from. This is the SAME `readdirSync`-based
 * helper the five-member EXPECTED_IMPORTERS test above uses -- reused, not a
 * second directory walk -- filtered down to the r2000 name pattern. */
function r2000ProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^r2000-.*\.ts$/.test(name));
}

// Measured true count as of this phase (11.1-03, 2026-08-21): 14 production
// r2000-*.ts modules on disk. This floor must be RAISED, never lowered, as
// the family grows -- an empty or broken glob (e.g. a typo'd filter regex,
// or a directory walk that silently resolves to the wrong path) must fail
// this test rather than pass vacuously, which is the exact defect INT-01
// found in the ten-name hard-coded array this replaces.
const R2000_MODULE_FLOOR = 14;

test("the r2000 module family (D-08/R2000-02) is derived from disk with a non-vacuity floor, not a hard-coded list (INT-01/D-11.1-03)", () => {
  const modules = r2000ProductionModules();
  assert.ok(
    modules.length >= R2000_MODULE_FLOOR,
    `expected >= ${R2000_MODULE_FLOOR} r2000-*.ts production modules on disk, found ${modules.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the absence assertion below pass trivially",
  );
});

test("INT-01's positive control: the four modules the audit found uncovered are present in the derived r2000 set", () => {
  // The finding's own reproduction, kept as a permanent test: if a future
  // rename or move drops one of these out of the glob, this says which one
  // -- rather than the absence test below silently stopping short again.
  const modules = r2000ProductionModules();
  for (const name of ["r2000-acme-ident.ts", "r2000-regbits-gen.ts", "r2000-symbols.ts", "r2000-test-gate.ts"]) {
    assert.ok(modules.includes(name), `${name} (named by INT-01 as uncovered) must be present in the derived r2000 module set`);
  }
});

test("the r2000 module family (D-08/R2000-02) is absent from the consumer set -- regenerator2000 runs container-side (D-R4), the mirror image of DERIV-07's wrongly-translated screenshot path", () => {
  const importers = hostpathImporters();
  const r2000Modules = r2000ProductionModules();
  // Non-vacuity is asserted separately above; this loop still guards against
  // an empty array silently making every assertion below vacuously true.
  assert.ok(r2000Modules.length > 0, "r2000ProductionModules() must not be empty");
  for (const name of r2000Modules) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});

test("planted violation (INT-01 proof): a synthetic r2000-shaped source that DOES import hostpath.ts is reported by the same predicate the real scan uses", () => {
  const plantedViolation = `import { hostPath } from "./hostpath.ts";\nexport function doSomething() {}\n`;
  const plantedClean = `export function doSomething() {}\n`;
  assert.equal(
    importsHostpath(stripCommentLines(plantedViolation)),
    true,
    "the predicate must report a genuine hostpath.ts import -- if this fails, the absence assertion above is not actually capable of catching a real violation",
  );
  assert.equal(importsHostpath(stripCommentLines(plantedClean)), false, "a clean source with no hostpath.ts mention must not be reported");
});

// D-05-12: the derived-module guess this test used to make -- stripping the
// "vice_" prefix off the tool name and prefixing "stock-" -- produced an
// UNDERSCORE-bearing name for every multi-word tool -- e.g. vice_memory_search
// guessed "stock-memory_search.ts", never matching the real hyphenated
// "stock-memory-search.ts" -- so the absence assertion could never match a
// real file for any multi-word tool name and read as coverage while testing
// nothing (only vice_disassemble's single-word name ever produced a real
// hit). This declared map replaces the guess: every STOCK_DERIVED_TOOLS
// member is named explicitly, and its filename is asserted to exist on disk
// so a typo fails loudly instead of passing vacuously.
const DERIVED_TOOL_MODULES: Record<string, string> = {
  vice_disassemble: "stock-disassemble.ts",
  vice_memory_search: "stock-memory-search.ts",
  vice_memory_compare: "stock-memory-search.ts",
  vice_symbols_load: "stock-symbols.ts",
  vice_symbols_lookup: "stock-symbols.ts",
  vice_vicii_get_state: "stock-vicii.ts",
  vice_cia_get_state: "stock-cia.ts",
  vice_sprite_get: "stock-sprites.ts",
  vice_sprite_inspect: "stock-sprites.ts",
  vice_cycles_stopwatch: "stock-timing.ts",
  vice_run_until: "stock-run-until.ts",
  vice_diagnose: "stock-diagnose.ts",
  vice_recycle: "stock-recycle.ts",
};

test("D-05-12: DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly", () => {
  const mapped = Object.keys(DERIVED_TOOL_MODULES).sort();
  const registered = [...STOCK_DERIVED_TOOLS].sort();
  assert.deepEqual(mapped, registered, "a derived tool with no DERIVED_TOOL_MODULES entry must fail this test rather than escape it");
});

test("D-05-12: every DERIVED_TOOL_MODULES filename exists on disk", () => {
  for (const [toolName, moduleName] of Object.entries(DERIVED_TOOL_MODULES)) {
    assert.equal(existsSync(join(HERE, moduleName)), true, `${moduleName} (implementing derived tool ${toolName}) must exist in .claude/mcp/vice`);
  }
});

test("D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set", () => {
  // Uses the declared map, not a guess at file names -- a FUTURE derived
  // tool that reaches hostpath.ts fails THIS test rather than shipping,
  // which is the whole point of a second, independent enforcement
  // mechanism (D-02): one structural test alone was rejected because CR-07
  // proved a structural test can pass while the real violation stands.
  const importers = new Set(hostpathImporters());
  const distinctModules = new Set(Object.values(DERIVED_TOOL_MODULES));
  for (const moduleName of distinctModules) {
    assert.equal(importers.has(moduleName), false, `${moduleName} (implementing a STOCK_DERIVED_TOOLS entry) must not import hostpath.ts`);
  }
});
