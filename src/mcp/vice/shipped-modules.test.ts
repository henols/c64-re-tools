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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  codeOnly,
  commentByteTotal,
  extractCommentSpans,
  shippedScanSurface,
  shippedTsModules,
  ShippedFilesEntryMissingError,
} from "./shipped-modules.ts";
import { HOST_BOUND_ARTIFACTS } from "./build.ts";

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
  const src = 'spawnSync(ANNO_BIN, ["--version"], { encoding: "utf8" });';
  const code = codeOnly(src);
  assert.match(code, /spawnSync\(ANNO_BIN/, "a genuine call must remain discoverable after stripping");
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

test("codeOnly(): a regex literal containing a backtick or a quote does not swallow the code after it", () => {
  // CR-01, phase 27. This shape shipped green because no test in this file
  // contained a `/` regex at all. Without a regex-literal branch, the
  // backtick inside the character class opens a phantom TEMPLATE frame the
  // scanner never leaves, and every remaining line of the file vanishes from
  // the "code" the consuming guards match against.
  const src = 'const r = /[`*_]/g;\nspawnSync(ANNO_BIN, []);\nconst s = "HIDDEN";\n';
  const code = codeOnly(src);
  assert.match(code, /spawnSync\(ANNO_BIN/, "code after a regex literal must stay visible");
  assert.equal(/HIDDEN/.test(code), false, "and a real string literal after it must still be blanked");

  const singleQuoted = codeOnly("const r = /'/g;\nspawnSync(ANNO_BIN, []);\n");
  assert.match(singleQuoted, /spawnSync\(ANNO_BIN/, "a quote inside a regex must not open a string frame either");

  const doubleQuoted = codeOnly('const r = /["]/g;\nspawnSync(ANNO_BIN, []);\n');
  assert.match(doubleQuoted, /spawnSync\(ANNO_BIN/, "nor a double quote inside a character class");
});

test("codeOnly(): the two real modules CR-01 was measured on are scanned whole, not truncated", () => {
  // The regression half of CR-01, stated against the shipped tree rather
  // than a synthetic string -- a future rewrite of the state machine that
  // reintroduces the truncation fails HERE with the module named. Both
  // modules are real `files[]` entries whose regex bodies contain a
  // backtick (`anno-coverage.ts:1495`) and a single quote
  // (`incident-record.ts:107`); before the fix the first was truncated from
  // 2329 lines to 1107 and the second from 443 to 89. Symbols are asserted
  // rather than line counts, so ordinary growth in either module does not
  // redden this.
  const expected: Record<string, string[]> = {
    "anno-coverage.ts": [
      "computeCommentVacuity",
      "computeReproducibility",
      "COVERAGE_REPORT_KEYS",
      "coverageFindings",
    ],
    "incident-record.ts": ["renderIncidentRecord", "writeIncidentRecord", "finaliseIncidentRecord"],
  };
  for (const [module, symbols] of Object.entries(expected)) {
    assert.ok(
      shippedTsModules().includes(module),
      `${module} must still be a files[] entry for this regression assertion to mean anything`,
    );
    const code = codeOnly(readFileSync(join(HERE, module), "utf8"));
    for (const symbol of symbols) {
      assert.ok(
        code.includes(symbol),
        `${module}: "${symbol}" is declared after that module's regex literal and is missing from ` +
          `codeOnly()'s output -- the scanner is truncating again (CR-01), so every guard reading this ` +
          `module is enforcing its invariant over a partial file`,
      );
    }
  }
});

test("codeOnly(): a division is NOT read as a regex opener, in either direction", () => {
  // The permissive failure mode of the CR-01 fix: misreading `/` as a regex
  // opener consumes real code as literal text. Both keyword position (where
  // a regex IS legal) and value position (where it is division) are pinned.
  assert.match(codeOnly("const q = total / count;\nspawnSync(ANNO_BIN, []);\n"), /total \/ count/);
  assert.match(codeOnly("const q = f() / 2;\nspawnSync(ANNO_BIN, []);\n"), /spawnSync\(ANNO_BIN/);
  assert.match(codeOnly("const q = arr[0] / 2;\nspawnSync(ANNO_BIN, []);\n"), /spawnSync\(ANNO_BIN/);
  assert.match(
    codeOnly('function f() { return /x/.test("HIDDEN"); }'),
    /return \/x\/\.test\(/,
    "after `return` a `/` IS a regex opener, and the string argument must still be blanked",
  );
  assert.equal(/HIDDEN/.test(codeOnly('function f() { return /x/.test("HIDDEN"); }')), false);
});

test("codeOnly(keepLiteralBodies = true) reconstructs every literal shape exactly", () => {
  // The flag threads through the quote, backtick, interpolation and escape
  // branches, but was only ever exercised on ONE double-quoted import
  // specifier (WR-01). Each source below is comment-free, so keep-mode is
  // required to be byte-lossless.
  for (const src of [
    'const d = `a ${f("x")} b`;',
    "const d = `a ${`inner ${g()}`} b`;",
    'const s = "a\\"b";',
    "const s = 'a\\'b';",
    "const r = /[`*_]/g;",
    "const r = /'/g;",
    "const t = `text ${obj.in / 2} more`;",
  ]) {
    assert.equal(codeOnly(src, true), src, `keepLiteralBodies must be lossless for ${src}`);
  }
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

// ---------------------------------------------------------------------------
// extractCommentSpans() / commentByteTotal() -- moved here from
// comment-phase-pointers.test.ts, which now imports both rather than
// defining its own copy. The positive-control case below moved verbatim
// (retitled); commentByteTotal() is new, driven over the same shape of
// sample so both the extractor and the wrapper summing its output are
// proven from one fixture.
// ---------------------------------------------------------------------------

test("extractCommentSpans(): captures comments and skips string/template literal bodies", () => {
  const sample =
    'const a = "Phase 99 inside a string, not a comment";\n' +
    "// Phase 99 inside a real line comment\n" +
    "const b = `template with Phase 99 inside a string too, plus ${1 + 1} interpolation`;\n" +
    "/* Phase 99 inside a real block comment */\n";
  const spans = extractCommentSpans(sample);
  const commentTexts = spans.map((s) => s.text).join("\n");
  assert.match(commentTexts, /Phase 99 inside a real line comment/, "the extractor must capture the line comment");
  assert.match(commentTexts, /Phase 99 inside a real block comment/, "the extractor must capture the block comment");
  assert.doesNotMatch(
    commentTexts,
    /inside a string, not a comment/,
    "the extractor must not capture string-literal bodies",
  );
  assert.doesNotMatch(
    commentTexts,
    /template with Phase 99 inside a string too/,
    "the extractor must not capture template-literal bodies",
  );
});

test("commentByteTotal(): counts comment span characters and nothing else", () => {
  const sample =
    'const a = "not counted, even though it is long";\n' +
    "// counted\n" +
    "const b = `also not counted ${1 + 1}`;\n" +
    "/* counted\n   across two lines too */\n";
  const spans = extractCommentSpans(sample);
  const expected = spans.reduce((sum, s) => sum + s.text.length, 0);
  assert.equal(
    commentByteTotal(sample),
    expected,
    "commentByteTotal() must equal the sum of every span's own text length, not re-walk the source itself",
  );
  assert.ok(expected > 0, "the sample must actually contain comment spans, or this assertion is vacuous");
  assert.equal(commentByteTotal(""), 0, "an empty source has zero comment bytes");
  assert.equal(
    commentByteTotal('const s = "no comments at all, just a long string literal";'),
    0,
    "a string literal contributes nothing to the comment-byte total, however long it is",
  );
});

// ---------------------------------------------------------------------------
// shippedScanSurface() -- the four-source enumerator. Driven against a
// synthetic root shaped like the real repo (src/mcp/vice/, installer/,
// src/skills/), never against the live files[] arrays, for the same
// pinned-total reasoning withSyntheticPackage() above already states.
// ---------------------------------------------------------------------------

/** Builds a throwaway root shaped like the real repo -- `src/mcp/vice/` (with
 * its own `package.json`), `installer/` (with its own `package.json`), and
 * `src/skills/` -- for driving `shippedScanSurface()` against a synthetic
 * tree. Every REAL `HOST_BOUND_ARTIFACTS` name gets a `.mts` stub under the
 * synthetic `src/mcp/vice/` by default (source 2 is not root-parameterized:
 * it always reads the real constant), so a case that does not care about the
 * host-bound source does not have to enumerate all ten by hand; a case that
 * DOES care can omit exactly one via `omitHostBoundArtifact` to prove the
 * missing-entry throw. */
function withSyntheticShippedRoot<T>(
  spec: {
    viceFiles: string[];
    viceFilesOnDisk: string[];
    installerFiles: string[];
    installerFilesOnDisk: string[];
    skillFilesOnDisk: string[];
    omitHostBoundArtifact?: string;
  },
  fn: (root: string) => T,
): T {
  const root = mkdtempSync(join(tmpdir(), "shipped-scan-surface-"));
  try {
    const viceDir = join(root, "src", "mcp", "vice");
    mkdirSync(viceDir, { recursive: true });
    writeFileSync(join(viceDir, "package.json"), JSON.stringify({ files: spec.viceFiles }), "utf8");
    for (const rel of spec.viceFilesOnDisk) {
      const abs = join(viceDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "// synthetic\n", "utf8");
    }
    for (const mjsName of HOST_BOUND_ARTIFACTS) {
      if (mjsName === spec.omitHostBoundArtifact) continue;
      const mtsAbs = join(viceDir, mjsName.replace(/\.mjs$/, ".mts"));
      mkdirSync(dirname(mtsAbs), { recursive: true });
      writeFileSync(mtsAbs, "// synthetic host-bound source\n", "utf8");
    }

    const installerDir = join(root, "installer");
    mkdirSync(installerDir, { recursive: true });
    writeFileSync(join(installerDir, "package.json"), JSON.stringify({ files: spec.installerFiles }), "utf8");
    for (const rel of spec.installerFilesOnDisk) {
      const abs = join(installerDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "// synthetic\n", "utf8");
    }

    const skillsDir = join(root, "src", "skills");
    mkdirSync(skillsDir, { recursive: true });
    for (const rel of spec.skillFilesOnDisk) {
      const abs = join(skillsDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "synthetic skill content\n", "utf8");
    }

    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("shippedScanSurface(): expands directories, unions the host-bound sources, and throws on a stale entry", () => {
  const found = withSyntheticShippedRoot(
    {
      viceFiles: ["alpha.ts", "resources", "README.md", "gamma.json"],
      viceFilesOnDisk: ["alpha.ts", "resources/nested/deep.mjs", "README.md", "gamma.json"],
      installerFiles: ["bin/", "README.md"],
      installerFilesOnDisk: ["bin/cli.mjs", "README.md"],
      skillFilesOnDisk: ["some-skill/SKILL.md"],
    },
    (root) => shippedScanSurface(root),
  );

  assert.ok(found.includes("src/mcp/vice/alpha.ts"), "a direct file entry must be present");
  assert.ok(
    found.includes("src/mcp/vice/resources/nested/deep.mjs"),
    "a directory files[] entry must be walked recursively to reach a nested file",
  );
  assert.ok(found.includes("installer/bin/cli.mjs"), "an installer directory entry must be walked too");
  assert.ok(found.includes("src/skills/some-skill/SKILL.md"), "the skills tree source must be represented");
  for (const mjsName of HOST_BOUND_ARTIFACTS) {
    const mtsRel = `src/mcp/vice/${mjsName.replace(/\.mjs$/, ".mts")}`;
    assert.ok(
      found.includes(mtsRel),
      `host-bound source ${mtsRel} must be unioned in even though it is not in files[]`,
    );
  }

  // A stale files[] entry throws the shared named error, naming the entry --
  // never a silently narrowed list.
  assert.throws(
    () =>
      withSyntheticShippedRoot(
        {
          viceFiles: ["alpha.ts", "vanished.ts"],
          viceFilesOnDisk: ["alpha.ts"],
          installerFiles: [],
          installerFilesOnDisk: [],
          skillFilesOnDisk: [],
        },
        (root) => shippedScanSurface(root),
      ),
    (err: unknown) => {
      assert.ok(err instanceof ShippedFilesEntryMissingError, "a stale entry must raise the named error");
      assert.match((err as Error).message, /vanished\.ts/);
      return true;
    },
    "a stale files[] entry must throw rather than silently shrinking the widened surface too",
  );

  // A missing installer/skills/ directory must NOT throw -- it is a
  // generated-mirror exclusion this function skips before ever checking
  // whether the entry exists on disk, not a files[] entry it reads.
  const withoutInstallerSkills = withSyntheticShippedRoot(
    {
      viceFiles: ["alpha.ts"],
      viceFilesOnDisk: ["alpha.ts"],
      installerFiles: ["skills/", "README.md"],
      installerFilesOnDisk: ["README.md"], // deliberately no skills/ directory on disk
      skillFilesOnDisk: ["some-skill/SKILL.md"],
    },
    (root) => shippedScanSurface(root),
  );
  assert.ok(
    withoutInstallerSkills.includes("installer/README.md"),
    "the rest of installer/package.json's files[] must still be scanned even when skills/ is absent",
  );
  assert.ok(
    !withoutInstallerSkills.some((f) => f.startsWith("installer/skills/")),
    "no installer/skills/ path should appear when the directory does not exist on disk",
  );
});
