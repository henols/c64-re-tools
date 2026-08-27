#!/usr/bin/env node
// shipped-modules.test.ts -- the committed proof for the two shared
// structural-guard helpers in `shipped-modules.ts` (SEAM-02).
//
// WHY THIS FILE EXISTS: `shippedTsModules()` decides WHAT four separate
// structural guards scan, and `codeOnly()` decides what those guards can
// SEE inside each scanned file. Both fail silently when they fail: an
// enumerator that returns a short list, or a stripper that blanks too much,
// makes every consuming guard pass while finding nothing. Neither failure
// is observable from any consuming guard's own output, so it is asserted
// here instead.
//
// The enumerator tests drive the helper against SYNTHETIC `package.json`
// inputs in a temp directory, never against the real `files[]` array. A test
// that pinned the live array would go red every time that array legitimately
// grows -- the pinned-total failure this repo has already been bitten by --
// and would tell us nothing about the helper. The synthetic inputs exercise
// the same code path the real scan uses (the planted-violation shape
// `hostpath-consumers.test.ts` established), one known-bad case and one
// known-good control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly, shippedTsModules, ShippedFilesEntryMissingError } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_NAME = "shipped-modules.ts";

/** Builds a throwaway directory holding a synthetic `package.json` with the
 * given `files[]`, plus an empty file on disk for each name in `onDisk`. */
function withSyntheticPackage<T>(files: string[], onDisk: string[], fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "shipped-modules-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ files }), "utf8");
    for (const name of onDisk) writeFileSync(join(dir, name), "// synthetic\n", "utf8");
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("shippedTsModules(): returns every files[] entry ending .ts or .mts, and nothing else", () => {
  const entries = withSyntheticPackage(
    ["alpha.ts", "beta.mts", "gamma.json", "README.md", "delta.js", "resources/"],
    ["alpha.ts", "beta.mts"],
    (dir) => shippedTsModules(dir),
  );
  assert.deepEqual(entries, ["alpha.ts", "beta.mts"]);
});

test("planted violation: a files[] entry missing from disk THROWS a named error, and never returns a short list", () => {
  withSyntheticPackage(["alpha.ts", "vanished.ts"], ["alpha.ts"], (dir) => {
    assert.throws(
      () => shippedTsModules(dir),
      (err: unknown) => {
        assert.ok(
          err instanceof ShippedFilesEntryMissingError,
          "a stale files[] entry must raise the named error, not a bare Error",
        );
        assert.match((err as Error).message, /vanished\.ts/);
        assert.match((err as Error).message, /letting the scanned set shrink silently/);
        return true;
      },
      "if a stale files[] entry does NOT throw here, the enumerator can silently narrow all four consuming guards at once and every one of them still passes -- the exact failure this assertion exists to catch",
    );
  });
  // Non-vacuity control: the identical shape with every entry present must
  // return the full list rather than throw, so the assertion above cannot be
  // passing because the helper simply always throws.
  const clean = withSyntheticPackage(["alpha.ts", "beta.ts"], ["alpha.ts", "beta.ts"], (dir) =>
    shippedTsModules(dir),
  );
  assert.deepEqual(clean, ["alpha.ts", "beta.ts"]);
});

test("shippedTsModules(): a files[] with no .ts/.mts entries returns an empty array without throwing", () => {
  const entries = withSyntheticPackage(["only.json", "README.md"], [], (dir) => shippedTsModules(dir));
  assert.deepEqual(entries, [], "the empty case must be distinguishable from the missing-file case");
});

test("codeOnly(): blanks single-quoted, double-quoted and TEMPLATE-literal bodies", () => {
  const src = [
    'const a = "FORBIDDEN_TOKEN";',
    "const b = 'FORBIDDEN_TOKEN';",
    "const c = `FORBIDDEN_TOKEN`;",
    "const d = `prefix ${realCode()} FORBIDDEN_TOKEN`;",
  ].join("\n");
  const code = codeOnly(src);
  assert.equal(
    /FORBIDDEN_TOKEN/.test(code),
    false,
    "a forbidden token hidden inside any of the three literal shapes must not survive stripping -- the template-literal case is the one a regex extractor was measured to miss",
  );
  assert.match(code, /realCode\(\)/, "code inside a template interpolation is real code and must survive");
});

test("codeOnly(): blanks // line comments, same-line /* */ blocks, and a block comment spanning lines", () => {
  const src = [
    "// FORBIDDEN_TOKEN in a line comment",
    "const a = 1; /* FORBIDDEN_TOKEN same line */ const b = 2;",
    "/* opening here",
    "   FORBIDDEN_TOKEN continues across lines",
    "   and closes here */",
    "const c = 3;",
  ].join("\n");
  const code = codeOnly(src);
  assert.equal(/FORBIDDEN_TOKEN/.test(code), false);
  assert.match(code, /const a = 1;/);
  assert.match(code, /const b = 2;/);
  assert.match(code, /const c = 3;/);
});

test("codeOnly(): leaves real identifiers and call syntax intact, so a genuine occurrence still matches", () => {
  const src = 'spawnSync(R2000_BIN, ["--version"], { encoding: "utf8" });';
  const code = codeOnly(src);
  assert.match(code, /spawnSync\(R2000_BIN/, "a genuine call must remain discoverable after stripping");
});

test("codeOnly(keepLiteralBodies = true): keeps literal text, for the caller reading an import specifier", () => {
  const src = 'import { x } from "node:zlib";\n';
  const specifiers = [...codeOnly(src, true).matchAll(/^\s*import\s[^;]*?from\s+"([^"]*)"/gm)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["node:zlib"], "an import specifier IS a string, so that one caller needs the body");
  assert.equal(
    /node:zlib/.test(codeOnly(src)),
    false,
    "the default must still blank it, or a module name in prose could satisfy a code check",
  );
});

test(`${MODULE_NAME} is absent from package.json's files[] array (test-only, mechanically enforced)`, () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes(MODULE_NAME),
    false,
    `${MODULE_NAME} is test-only and must never ship in the published npm tarball`,
  );
});

test(`${MODULE_NAME} is not collected as a test file and registers no test at import time`, () => {
  assert.equal(
    /\.test\./.test(MODULE_NAME),
    false,
    `${MODULE_NAME} must not match the '*.test.*' glob the "test" script runs, or the runner would collect it as a test file`,
  );
  const src = readFileSync(join(HERE, MODULE_NAME), "utf8");
  const runnerModule = ["node", "test"].join(":");
  assert.equal(
    src.includes(runnerModule),
    false,
    "importing the test runner here would register top-level tests as an import side effect, duplicating them inside every importing file",
  );
  assert.equal(
    /^\s*test\s*\(/m.test(codeOnly(src)),
    false,
    "no top-level test registration may run when this module is imported",
  );
});
