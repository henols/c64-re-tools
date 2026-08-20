#!/usr/bin/env node
// Pins both halves of D-07 (R2000-01) for r2000-launch.ts: --vice is
// unreachable BY CONSTRUCTION (fixed per-verb builders, no caller-supplied
// argv pass-through) AND denied BY SCAN (assertNoViceFlag/runR2000 throw a
// named error if the flag is present). Both are asserted, not either/or,
// and each assertion is written so its failure mode is a *reintroduction*
// of the hazard -- someone later adding a pass-through parameter, or
// removing the scan -- rather than a static fact that can never regress.
//
// Every assertion here runs with no network, no emulator and no
// regenerator2000 binary present, so this file is safe for the automated
// gate and must NEVER be added to test-gate.mjs's MANUAL_ONLY_TESTS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  R2000_BIN,
  assertNoViceFlag,
  buildExportAsmArgs,
  buildVerifyArgs,
  runR2000,
  R2000ViceFlagError,
} from "./r2000-launch.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Strips full-line `//` comments AND full JSDoc block comments before
 * matching source text -- extends hostpath-consumers.test.ts's
 * grep-gate-hygiene idiom (never a bare `includes()` against raw file text
 * that would count comments and string literals as real code). The block-
 * comment handling is needed here specifically because r2000-launch.ts's
 * own header/JSDoc prose discusses "a rest parameter" and "the rest of the
 * function" in plain English -- without stripping block comments, those
 * prose sentences would false-positive the identifier scan below. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;
  for (const line of src.split("\n")) {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.endsWith("*/")) inBlock = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.endsWith("*/")) inBlock = true;
      continue;
    }
    if (/^\s*\/\//.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

// -- 1. Deny-by-scan, positive: the plain `--vice` token --------------------

test("assertNoViceFlag throws R2000ViceFlagError naming the single-client hazard for a plain --vice token", () => {
  const argv = ["--headless", "--vice", "localhost:6502", "proj.regen2000proj"];
  assert.throws(
    () => assertNoViceFlag(argv),
    (err: unknown) => {
      assert.ok(err instanceof R2000ViceFlagError);
      assert.equal(err.name, "R2000ViceFlagError");
      assert.match(err.message, /exactly one client/);
      return true;
    }
  );
});

// -- 2. Deny-by-scan, --vice=<value> single-token form -----------------------

test("assertNoViceFlag throws the same named error for the --vice=<value> single-token form", () => {
  const argv = ["--vice=localhost:6502"];
  assert.throws(
    () => assertNoViceFlag(argv),
    (err: unknown) => {
      assert.ok(err instanceof R2000ViceFlagError);
      assert.equal(err.name, "R2000ViceFlagError");
      return true;
    }
  );
});

// -- 3. Never-strip: no filtering function exists, and a clean argv is left --
//       untouched (void/throwing contract, not a filtered-copy contract) --

test("assertNoViceFlag returns undefined and leaves a clean argv unchanged (void/throwing contract, never a filter)", () => {
  const argv = ["--headless", "--export_asm", "out.a", "--assembler", "acme", "proj.regen2000proj"];
  const before = [...argv];
  const result = assertNoViceFlag(argv);
  assert.equal(result, undefined);
  assert.deepEqual(argv, before);
});

test("r2000-launch.ts contains no filter(...) call over the deny list -- the flag is never silently stripped", () => {
  const src = stripCommentLines(readFileSync(join(HERE, "r2000-launch.ts"), "utf8"));
  assert.equal(
    /\.filter\(/.test(src),
    false,
    "r2000-launch.ts must never filter argv against FORBIDDEN_R2000_FLAGS -- D-07 requires a loud throw, not a silent strip"
  );
});

// -- 4. No false positive on a filename containing the substring "--vice" --

test("assertNoViceFlag does not throw on a filename that merely contains the substring --vice", () => {
  assert.doesNotThrow(() => {
    assertNoViceFlag(["--export_asm", "/tmp/my--vice-notes.a", "proj.regen2000proj"]);
  });
});

// -- 5. runR2000 enforces the scan before any subprocess is spawned ---------

test("runR2000 throws R2000ViceFlagError before spawning, even with a binary name guaranteed not to exist", () => {
  const originalBin = process.env.R2000_BIN;
  process.env.R2000_BIN = "definitely-not-installed-r2000-binary-xyz";
  try {
    assert.throws(
      () => runR2000(["--vice", "localhost:6502"]),
      (err: unknown) => {
        assert.ok(err instanceof R2000ViceFlagError, "must throw the flag error, not an ENOENT spawn error");
        assert.equal(err.name, "R2000ViceFlagError");
        return true;
      }
    );
  } finally {
    if (originalBin === undefined) delete process.env.R2000_BIN;
    else process.env.R2000_BIN = originalBin;
  }
});

test("R2000_BIN itself resolves from the environment at module load (documented override convention)", () => {
  assert.equal(typeof R2000_BIN, "string");
  assert.ok(R2000_BIN.length > 0);
});

// -- 6. Deny-by-construction: no rest parameter / pass-through identifier --
//       exists anywhere in the source (the reintroduction regression) ------

test("D-07 construction half: r2000-launch.ts source contains no rest-parameter or pass-through-named field -- catches a future reintroduction of a caller-supplied argv passthrough", () => {
  const src = stripCommentLines(readFileSync(join(HERE, "r2000-launch.ts"), "utf8"));
  const hasRestParam = /\.\.\.[a-zA-Z]+\s*:\s*(readonly\s+)?string\[\]/.test(src);
  const hasForbiddenIdentifier = /\bextraArgs\b|\bpassthrough\b|\brest\b/.test(src);
  assert.equal(
    hasRestParam,
    false,
    "adding a caller-supplied argv passthrough (a rest parameter typed as a string array) is exactly what this test exists to catch"
  );
  assert.equal(
    hasForbiddenIdentifier,
    false,
    "adding a caller-supplied argv passthrough (an identifier named extraArgs, passthrough, or rest) is exactly what this test exists to catch"
  );
});

// -- 7. Builder output shape ------------------------------------------------

test("buildExportAsmArgs and buildVerifyArgs each return a string[] with --assembler acme and no --vice token", () => {
  for (const argv of [
    buildExportAsmArgs({ projectPath: "proj.regen2000proj", outPath: "out.a" }),
    buildVerifyArgs({ projectPath: "proj.regen2000proj" }),
  ]) {
    assert.ok(Array.isArray(argv));
    for (const el of argv) assert.equal(typeof el, "string");
    const assemblerIdx = argv.indexOf("--assembler");
    assert.ok(assemblerIdx >= 0, "argv must contain --assembler");
    assert.equal(argv[assemblerIdx + 1], "acme");
    assert.equal(argv.includes("--vice"), false);
    assert.equal(
      argv.some((el) => el.startsWith("--vice=")),
      false
    );
  }
});
